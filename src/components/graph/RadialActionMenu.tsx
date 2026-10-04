import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  isContinuumMode?: boolean;
  isBranchLimitReached?: boolean;
  isParentTaskFinished?: boolean;
  hasChildren?: boolean;
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
  isContinuumMode = false,
  isBranchLimitReached = false,
  isParentTaskFinished = false,
  hasChildren = false,
  onSelectAction,
  onClose
}) => {
  const [hoveredActionId, setHoveredActionId] = useState<RadialAction['id'] | null>(null);
  const hoveredActionIdRef = useRef<RadialAction['id'] | null>(null);
  hoveredActionIdRef.current = hoveredActionId;

  const onSelectActionRef = useRef(onSelectAction);
  onSelectActionRef.current = onSelectAction;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isPointerDownRef = useRef(true);
  const didDragRef = useRef(false);
  const mountTimeRef = useRef(Date.now());

  const radius = 56;
  const count = ACTIONS.length;
  const angleStep = (2 * Math.PI) / count;

  // Pre-calculate positions of all radial bubbles once
  const bubblePositions = useMemo(() => {
    return ACTIONS.map((action, index) => {
      // Start from top (-PI / 2) and spread clockwise
      const angle = index * angleStep - Math.PI / 2;
      return {
        action,
        angle,
        bx: Math.cos(angle) * radius,
        by: Math.sin(angle) * radius
      };
    });
  }, [radius, angleStep]);

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
    const pAngle = Math.atan2(relY, relX);

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

  // Global pointer listeners for Pinterest drag & release gesture (stable bindings, zero listener churn)
  useEffect(() => {
    let rafId: number | null = null;
    let lastClientX = 0;
    let lastClientY = 0;

    const onMove = (e: PointerEvent) => {
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          handlePointerDrag(lastClientX, lastClientY);
        });
      }
    };

    const onUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      isPointerDownRef.current = false;
      const elapsed = Date.now() - mountTimeRef.current;
      const currentHovered = hoveredActionIdRef.current;

      // If user dragged toward an action bubble and released, activate it immediately!
      if (didDragRef.current && currentHovered) {
        onSelectActionRef.current(currentHovered);
        return;
      }

      // If it was a quick click near center, stay open so user can click a bubble
      if (!didDragRef.current && elapsed < 280) {
        return;
      }

      // If released outside with no selection after dragging, close
      if (didDragRef.current && !currentHovered) {
        onCloseRef.current();
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [handlePointerDrag]);

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
            border: isContinuumMode
              ? '1px dashed rgba(56, 189, 248, 0.35)'
              : '1px dashed rgba(24, 24, 24, 0.16)',
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
            backgroundColor: isContinuumMode
              ? 'rgba(56, 189, 248, 0.18)'
              : 'rgba(24, 24, 24, 0.08)',
            border: isContinuumMode ? '1.5px solid #38BDF8' : '1.5px solid #181818',
            pointerEvents: 'none'
          }}
        />

        {/* Action Bubbles */}
        {bubblePositions.map(({ action, bx, by }, index) => {
          const isHovered = hoveredActionId === action.id;
          const isBranchAction = action.id === 'step' || action.id === 'thought';
          const isDeleteBlocked = action.id === 'delete' && hasChildren;
          const isActionBlocked = (isBranchAction && (isParentTaskFinished || isBranchLimitReached)) || isDeleteBlocked;

          let bubbleBg = isHovered ? action.color : '#FAF0E6';
          let bubbleColor = isHovered ? '#F5E6D8' : action.color;
          let bubbleBorder = `1.5px solid ${isHovered ? action.color : 'rgba(24, 24, 24, 0.25)'}`;

          if (isContinuumMode) {
            if (isHovered) {
              if (action.id === 'abandon' || action.id === 'delete') {
                bubbleBg = '#BE123C';
                bubbleBorder = '1.5px solid #FB7185';
              } else {
                bubbleBg = '#0284C7';
                bubbleBorder = '1.5px solid #38BDF8';
              }
              bubbleColor = '#FFFFFF';
            } else {
              bubbleBg = isActionBlocked ? 'rgba(15, 23, 42, 0.75)' : '#090D16';
              bubbleColor = isActionBlocked ? '#64748B' : '#F0F9FF';
              bubbleBorder = `1.5px solid ${isActionBlocked ? 'rgba(100, 116, 139, 0.3)' : 'rgba(56, 189, 248, 0.45)'}`;
            }
          }

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
                  backgroundColor: bubbleBg,
                  color: bubbleColor,
                  border: bubbleBorder,
                  boxShadow: isContinuumMode
                    ? isHovered
                      ? '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 0 3px rgba(56, 189, 248, 0.3)'
                      : '0 4px 12px rgba(0, 0, 0, 0.5)'
                    : isHovered
                    ? '0 6px 16px rgba(0, 0, 0, 0.18), 0 0 0 3px rgba(24, 24, 24, 0.12)'
                    : '0 2px 8px rgba(0, 0, 0, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isActionBlocked ? 'not-allowed' : 'pointer',
                  position: 'relative',
                  transform: `scale(${isHovered ? 1.35 : 1})`,
                  opacity: isActionBlocked ? 0.6 : 1,
                  transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 140ms ease, color 140ms ease, box-shadow 180ms ease, opacity 140ms ease',
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
                      backgroundColor: isContinuumMode
                        ? isHovered ? '#FFFFFF' : '#0B132B'
                        : isHovered ? '#FAF0E6' : '#181818',
                      color: isContinuumMode
                        ? isHovered ? '#0B132B' : '#38BDF8'
                        : isHovered ? '#181818' : '#FAF0E6',
                      border: isContinuumMode ? '1px solid rgba(56, 189, 248, 0.5)' : undefined,
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
            backgroundColor: isContinuumMode
              ? 'rgba(7, 12, 20, 0.95)'
              : 'rgba(24, 24, 24, 0.94)',
            color: '#FFFFFF',
            border: isContinuumMode ? '1px solid rgba(56, 189, 248, 0.35)' : undefined,
            fontSize: '11px',
            fontWeight: 500,
            padding: '3px 10px',
            borderRadius: '12px',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
            pointerEvents: 'none',
            letterSpacing: '0.01em',
            transition: 'opacity 120ms ease',
            opacity: activeAction ? 1 : 0.75
          }}
        >
          {activeAction
            ? ((activeAction.id === 'step' || activeAction.id === 'thought') && isParentTaskFinished)
              ? 'Main task completed. Press Ctrl+N for new work'
              : ((activeAction.id === 'step' || activeAction.id === 'thought') && isBranchLimitReached)
              ? 'Limit reached (3000). Complete main task first'
              : (activeAction.id === 'delete' && hasChildren)
              ? 'Cannot delete: node has extended branches'
              : activeAction.label
            : node.title}
        </div>
      </div>
    </div>
  );
};
