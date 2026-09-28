import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CornerDownRight, Lightbulb, Target, Check, X, Trash2 } from 'lucide-react';
import { Node } from '../../domain/entities/types';

export interface RadialAction {
  id: 'step' | 'thought' | 'complete' | 'abandon' | 'focus' | 'delete';
  label: string;
  icon: React.ReactNode;
  color: string;
  shortcut: string;
}

interface RadialActionMenuProps {
  node: Node;
  x: number;
  y: number;
  showShortcuts?: boolean;
  onSelectAction: (actionId: RadialAction['id']) => void;
  onClose: () => void;
}

const ACTIONS: RadialAction[] = [
  { id: 'step', label: 'Add Step', shortcut: '1', icon: <CornerDownRight size={15} strokeWidth={2} />, color: '#181818' },
  { id: 'thought', label: 'Capture Thought', shortcut: '2', icon: <Lightbulb size={15} strokeWidth={1.8} />, color: '#181818' },
  { id: 'focus', label: 'Focus Here', shortcut: '3', icon: <Target size={15} strokeWidth={2} />, color: '#181818' },
  { id: 'complete', label: 'Complete Path', shortcut: '4', icon: <Check size={15} strokeWidth={2.2} />, color: '#181818' },
  { id: 'abandon', label: 'Drop / Abandon', shortcut: '5', icon: <X size={15} strokeWidth={2} />, color: '#8A251A' },
  { id: 'delete', label: 'Delete Node', shortcut: '6', icon: <Trash2 size={15} strokeWidth={2} />, color: '#B91C1C' }
];

export const RadialActionMenu: React.FC<RadialActionMenuProps> = ({
  node,
  x,
  y,
  showShortcuts = false,
  onSelectAction,
  onClose
}) => {
  const [hoveredActionId, setHoveredActionId] = useState<RadialAction['id'] | null>(null);
  const isPointerDownRef = useRef(true);
  const didDragRef = useRef(false);
  const mountTimeRef = useRef(Date.now());

  const radius = 56;
  const count = ACTIONS.length;
  const angleStep = (2 * Math.PI) / count;

  // Pre-calculate positions of all radial bubbles
  const bubblePositions = ACTIONS.map((action, index) => {
    // Start from top (-PI / 2) and spread clockwise
    const angle = index * angleStep - Math.PI / 2;
    return {
      action,
      angle,
      bx: Math.cos(angle) * radius,
      by: Math.sin(angle) * radius
    };
  });

  // Calculate which bubble (if any) the pointer is dragging toward
  const handlePointerDrag = useCallback((clientX: number, clientY: number) => {
    const relX = clientX - x;
    const relY = clientY - y;
    const dist = Math.hypot(relX, relY);

    if (dist > 14) {
      didDragRef.current = true;
    }

    if (dist < 22) {
      // Near center node, clear active bubble
      setHoveredActionId(null);
      return;
    }

    // Pointer angle from center
    let pAngle = Math.atan2(relY, relX);

    // Find the bubble with closest angle
    let closestId: RadialAction['id'] | null = null;
    let minAngleDiff = Infinity;

    bubblePositions.forEach(({ action, bx, by }) => {
      // Distance from pointer directly to bubble center
      const dToBubble = Math.hypot(relX - bx, relY - by);
      if (dToBubble < 32) {
        closestId = action.id;
        minAngleDiff = 0;
        return;
      }

      const bAngle = Math.atan2(by, bx);
      let diff = Math.abs(pAngle - bAngle);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;

      if (diff < minAngleDiff && diff < 0.65) {
        minAngleDiff = diff;
        closestId = action.id;
      }
    });

    setHoveredActionId(closestId);
  }, [x, y, bubblePositions]);

  // Global pointer listeners for Pinterest drag & release gesture
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      handlePointerDrag(e.clientX, e.clientY);
    };

    const onUp = () => {
      isPointerDownRef.current = false;
      const elapsed = Date.now() - mountTimeRef.current;

      // If user dragged toward an action bubble and released, activate it immediately!
      if (didDragRef.current && hoveredActionId) {
        onSelectAction(hoveredActionId);
        return;
      }

      // If it was a quick click near center, stay open so user can click a bubble
      if (!didDragRef.current && elapsed < 280) {
        return;
      }

      // If released outside with no selection after dragging, close
      if (didDragRef.current && !hoveredActionId) {
        onClose();
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [handlePointerDrag, hoveredActionId, onSelectAction, onClose]);

  // Keyboard Navigation: map 1-5 and Numpad1-5 (including Shift + Numpad / digits) to radial actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      const code = e.code;
      const key = e.key;

      if (code === 'Numpad1' || code === 'Digit1' || key === '1' || key === '!') {
        e.preventDefault();
        e.stopPropagation();
        onSelectAction('step');
      } else if (code === 'Numpad2' || code === 'Digit2' || key === '2' || key === '@') {
        e.preventDefault();
        e.stopPropagation();
        onSelectAction('thought');
      } else if (code === 'Numpad3' || code === 'Digit3' || key === '3' || key === '#') {
        e.preventDefault();
        e.stopPropagation();
        onSelectAction('focus');
      } else if (code === 'Numpad4' || code === 'Digit4' || key === '4' || key === '$') {
        e.preventDefault();
        e.stopPropagation();
        onSelectAction('complete');
      } else if (code === 'Numpad5' || code === 'Digit5' || key === '5' || key === '%') {
        e.preventDefault();
        e.stopPropagation();
        onSelectAction('abandon');
      } else if (e.key === 'Delete' || e.key === 'Backspace' || code === 'Numpad6' || code === 'Digit6' || key === '6' || key === '^') {
        e.preventDefault();
        e.stopPropagation();
        onSelectAction('delete');
      }
    };

    // Releasing Shift immediately dismisses the radial menu
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onSelectAction, onClose]);

  const activeAction = ACTIONS.find((a) => a.id === hoveredActionId);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        pointerEvents: 'auto',
        userSelect: 'none'
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${x}px`,
          top: `${y}px`,
          pointerEvents: 'none'
        }}
      >
        {/* Ripple / Guide Circle */}
        <div
          style={{
            position: 'absolute',
            transform: 'translate(-50%, -50%)',
            width: `${radius * 2}px`,
            height: `${radius * 2}px`,
            borderRadius: '50%',
            border: '1px dashed rgba(24, 24, 24, 0.16)',
            pointerEvents: 'none',
            animation: 'notionFadeIn 180ms ease-out'
          }}
        />

        {/* Central Anchor Node Pulse */}
        <div
          style={{
            position: 'absolute',
            transform: 'translate(-50%, -50%)',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'rgba(24, 24, 24, 0.08)',
            border: '1.5px solid #181818',
            pointerEvents: 'none'
          }}
        />

        {/* Pinterest Action Bubbles */}
        {bubblePositions.map(({ action, bx, by }, index) => {
          const isHovered = hoveredActionId === action.id;

          return (
            <div
              key={action.id}
              style={{
                position: 'absolute',
                left: `${bx}px`,
                top: `${by}px`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'auto'
              }}
            >
              <button
                onMouseEnter={() => setHoveredActionId(action.id)}
                onMouseLeave={() => {
                  if (!isPointerDownRef.current) setHoveredActionId(null);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAction(action.id);
                }}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: isHovered ? action.color : '#FAF0E6',
                  color: isHovered ? '#F5E6D8' : action.color,
                  border: `1.5px solid ${isHovered ? action.color : 'rgba(24, 24, 24, 0.25)'}`,
                  boxShadow: isHovered
                    ? '0 6px 16px rgba(0, 0, 0, 0.18), 0 0 0 3px rgba(24, 24, 24, 0.12)'
                    : '0 2px 8px rgba(0, 0, 0, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  transform: `scale(${isHovered ? 1.35 : 1})`,
                  transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 140ms ease, color 140ms ease, box-shadow 180ms ease',
                  animation: `bubblePop 220ms cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 25}ms backwards`
                }}
                title={showShortcuts ? `${action.label} (${action.shortcut})` : action.label}
                aria-label={action.label}
              >
                {action.icon}

                {/* Number / Numpad Key Overlay Badge - only shown when accessed via Shift */}
                {showShortcuts && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      width: '15px',
                      height: '15px',
                      borderRadius: '50%',
                      backgroundColor: isHovered ? '#FAF0E6' : '#181818',
                      color: isHovered ? '#181818' : '#FAF0E6',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.28)',
                      pointerEvents: 'none'
                    }}
                  >
                    {action.shortcut}
                  </div>
                )}
              </button>
            </div>
          );
        })}

        {/* Dynamic Label Pill */}
        <div
          style={{
            position: 'absolute',
            top: `${radius + 24}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(24, 24, 24, 0.94)',
            color: '#FAF0E6',
            fontSize: '11px',
            fontWeight: 500,
            padding: '3px 10px',
            borderRadius: '12px',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            pointerEvents: 'none',
            letterSpacing: '0.01em',
            transition: 'opacity 120ms ease',
            opacity: activeAction ? 1 : 0.75
          }}
        >
          {activeAction ? activeAction.label : node.title}
        </div>
      </div>
    </div>
  );
};
