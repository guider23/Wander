import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Node } from '../../domain/entities/types';
import { layoutOrganicTree, OrganicNodePoint } from '../../graph/layout/organic';
import { RadialActionMenu, RadialAction } from './RadialActionMenu';

interface OrganicAttentionTreeProps {
  nodes: Node[];
  activeNodeId: string | null;
  onOpenCommand: (kind: 'work' | 'thought' | 'step', contextNodeId: string, contextTitle: string) => void;
  onSwitchFocus: (nodeId: string) => void;
  onComplete: (nodeId: string) => void;
  onAbandon: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onStartNewWork: () => void;
  onNavigatedNodeChange?: (nodeId: string | null) => void;
}

export const OrganicAttentionTree: React.FC<OrganicAttentionTreeProps> = ({
  nodes,
  activeNodeId,
  onOpenCommand,
  onSwitchFocus,
  onComplete,
  onAbandon,
  onDeleteNode,
  onStartNewWork,
  onNavigatedNodeChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [radialNode, setRadialNode] = useState<{ node: Node; x: number; y: number; fromShift?: boolean } | null>(null);

  // Navigated / selected node (via keyboard or click)
  const [navigatedNodeId, setNavigatedNodeId] = useState<string | null>(activeNodeId);

  // Sync navigated node with activeNodeId
  useEffect(() => {
    if (activeNodeId) {
      setNavigatedNodeId(activeNodeId);
      onNavigatedNodeChange?.(activeNodeId);
    }
  }, [activeNodeId, onNavigatedNodeChange]);

  const updateNavigatedNode = (id: string | null) => {
    setNavigatedNodeId(id);
    onNavigatedNodeChange?.(id);
  };

  // Pan / Canvas drag state
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const startPanRef = useRef({ x: 0, y: 0 });

  const layout = useMemo(() => {
    return layoutOrganicTree(nodes, activeNodeId, {
      width: 1400,
      height: 1200
    });
  }, [nodes, activeNodeId]);

  // Seamlessly focus camera and living cursor on last focused node when starting up or switching trees
  const activeTreeId = nodes[0]?.treeId || null;
  useEffect(() => {
    if (!activeNodeId || !containerRef.current || layout.nodes.length === 0) return;
    const targetPoint = layout.nodes.find((n) => n.node.id === activeNodeId);
    if (targetPoint) {
      const rect = containerRef.current.getBoundingClientRect();
      const idealX = Math.round(rect.width / 2 - targetPoint.x);
      const idealY = Math.round(rect.height / 2 - targetPoint.y);
      setPanOffset({ x: idealX, y: idealY });
    }
  }, [activeTreeId, activeNodeId]);

  // Spatial & Tree Keyboard Navigation Engine
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const isDialogActive = !!document.querySelector('[role="dialog"]');
      if (isInput || isDialogActive) return;

      if (layout.nodes.length === 0) return;

      const currentId = navigatedNodeId || activeNodeId || layout.nodes[0]?.node.id;
      const currentPoint = layout.nodes.find((n) => n.node.id === currentId) || layout.nodes[0];
      if (!currentPoint) return;

      // When Shift is pressed down, open the radial action menu on the current node with numbers
      if (e.key === 'Shift') {
        setRadialNode({
          node: currentPoint.node,
          x: currentPoint.x + panOffset.x,
          y: currentPoint.y + panOffset.y,
          fromShift: true
        });
        return;
      }

      if (e.key === 'Escape') {
        setRadialNode(null);
        return;
      }

      // Check if user is triggering Shift + 1-6 or Shift + Numpad1-6 action
      const code = e.code;
      const key = e.key;
      const isOne = code === 'Numpad1' || code === 'Digit1' || key === '1' || key === '!';
      const isTwo = code === 'Numpad2' || code === 'Digit2' || key === '2' || key === '@';
      const isThree = code === 'Numpad3' || code === 'Digit3' || key === '3' || key === '#';
      const isFour = code === 'Numpad4' || code === 'Digit4' || key === '4' || key === '$';
      const isFive = code === 'Numpad5' || code === 'Digit5' || key === '5' || key === '%';
      const isSix = code === 'Numpad6' || code === 'Digit6' || key === '6' || key === '^';

      if (e.shiftKey && (isOne || isTwo || isThree || isFour || isFive || isSix)) {
        e.preventDefault();
        e.stopPropagation();
        const targetNode = radialNode?.node || currentPoint.node;
        setRadialNode(null);
        if (isOne) onOpenCommand('step', targetNode.id, targetNode.title);
        else if (isTwo) onOpenCommand('thought', targetNode.id, targetNode.title);
        else if (isThree) onSwitchFocus(targetNode.id);
        else if (isFour) onComplete(targetNode.id);
        else if (isFive) onAbandon(targetNode.id);
        else if (isSix) onDeleteNode(targetNode.id);
        return;
      }

      // Delete or Backspace key deletes currently selected/navigated node
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const targetId = navigatedNodeId || activeNodeId;
        if (targetId) {
          e.preventDefault();
          onDeleteNode(targetId);
          setRadialNode(null);
        }
        return;
      }

      // Disable navigation if Shift is held or if a numpad key was pressed
      // Arrow navigation is strictly reserved for the arrow pad (or standalone vim h/j/k/l)
      if (e.shiftKey || code.startsWith('Numpad')) {
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        if (currentPoint.node.id && currentPoint.node.id !== activeNodeId) {
          e.preventDefault();
          onSwitchFocus(currentPoint.node.id);
        }
        return;
      }

      const isUp = (e.key === 'ArrowUp' && code === 'ArrowUp') || (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'k' || e.key === 'K'));
      const isDown = (e.key === 'ArrowDown' && code === 'ArrowDown') || (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'j' || e.key === 'J'));
      const isLeft = (e.key === 'ArrowLeft' && code === 'ArrowLeft') || (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'h' || e.key === 'H'));
      const isRight = (e.key === 'ArrowRight' && code === 'ArrowRight') || (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'l' || e.key === 'L'));

      if (!isUp && !isDown && !isLeft && !isRight) return;

      const { x: cx, y: cy } = currentPoint;
      let bestCandidate: OrganicNodePoint | null = null;
      let minScore = Infinity;

      if (isUp) {
        e.preventDefault();
        for (const p of layout.nodes) {
          if (p.node.id === currentPoint.node.id) continue;
          const dy = cy - p.y;
          if (dy > 8) {
            const dx = Math.abs(p.x - cx);
            const score = dy + dx * 1.25;
            if (score < minScore) {
              minScore = score;
              bestCandidate = p;
            }
          }
        }
      } else if (isDown) {
        e.preventDefault();
        for (const p of layout.nodes) {
          if (p.node.id === currentPoint.node.id) continue;
          const dy = p.y - cy;
          if (dy > 8) {
            const dx = Math.abs(p.x - cx);
            const score = dy + dx * 1.25;
            if (score < minScore) {
              minScore = score;
              bestCandidate = p;
            }
          }
        }
      } else if (isLeft) {
        e.preventDefault();
        for (const p of layout.nodes) {
          if (p.node.id === currentPoint.node.id) continue;
          const dx = cx - p.x;
          if (dx > 12) {
            const dy = Math.abs(p.y - cy);
            const score = dx + dy * 1.35;
            if (score < minScore) {
              minScore = score;
              bestCandidate = p;
            }
          }
        }
      } else if (isRight) {
        e.preventDefault();
        for (const p of layout.nodes) {
          if (p.node.id === currentPoint.node.id) continue;
          const dx = p.x - cx;
          if (dx > 12) {
            const dy = Math.abs(p.y - cy);
            const score = dx + dy * 1.35;
            if (score < minScore) {
              minScore = score;
              bestCandidate = p;
            }
          }
        }
      }

      if (bestCandidate) {
        updateNavigatedNode(bestCandidate.node.id);

        // Keep navigated node in comfortable view by gently panning viewport if needed
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const screenX = bestCandidate.x + panOffset.x;
          const screenY = bestCandidate.y + panOffset.y;

          let deltaX = 0;
          let deltaY = 0;
          if (screenX < 140) deltaX = 180 - screenX;
          else if (screenX > rect.width - 140) deltaX = (rect.width - 180) - screenX;

          if (screenY < 120) deltaY = 160 - screenY;
          else if (screenY > rect.height - 120) deltaY = (rect.height - 160) - screenY;

          if (deltaX !== 0 || deltaY !== 0) {
            setPanOffset((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
          }
        }
      }
    };

    // Releasing Shift immediately dismisses the radial circle menu
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setRadialNode(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [navigatedNodeId, activeNodeId, layout.nodes, panOffset, onSwitchFocus, onOpenCommand, onComplete, onAbandon, onDeleteNode, radialNode]);

  if (nodes.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: '#F5E6D8',
          color: '#181818',
          cursor: 'pointer'
        }}
        onClick={onStartNewWork}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: '#181818'
            }}
          />
          <span style={{ fontSize: '1.15rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
            Start
          </span>
          <span style={{ fontSize: '0.88rem', color: '#6A625A' }}>
            Click or press Ctrl+N to record where your attention begins
          </span>
        </div>
      </div>
    );
  }

  // Canvas Pan Handlers
  const handlePointerDownCanvas = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.dataset?.nodeInteractive === 'true' || target.closest('[data-node-interactive="true"]')) {
      return;
    }
    setIsPanning(true);
    startPanRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - startPanRef.current.x,
      y: e.clientY - startPanRef.current.y
    });
  };

  const handlePointerUpCanvas = () => {
    setIsPanning(false);
  };

  // Node hold-and-drag gesture
  const handleNodePointerDown = (e: React.PointerEvent, node: Node, x: number, y: number) => {
    e.stopPropagation();
    updateNavigatedNode(node.id);
    const screenX = x + panOffset.x;
    const screenY = y + panOffset.y;
    setRadialNode({ node, x: screenX, y: screenY, fromShift: false });
  };

  const handleRadialAction = (actionId: RadialAction['id']) => {
    if (!radialNode) return;
    const { node } = radialNode;
    setRadialNode(null);

    switch (actionId) {
      case 'step':
        onOpenCommand('step', node.id, node.title);
        break;
      case 'thought':
        onOpenCommand('thought', node.id, node.title);
        break;
      case 'focus':
        onSwitchFocus(node.id);
        break;
      case 'complete':
        onComplete(node.id);
        break;
      case 'abandon':
        onAbandon(node.id);
        break;
      case 'delete':
        onDeleteNode(node.id);
        break;
    }
  };

  // Calculate current navigated node and active node positions
  const navPoint = layout.nodes.find((n) => n.node.id === (navigatedNodeId || activeNodeId)) || layout.nodes[0];
  const activePoint = layout.nodes.find((n) => n.node.id === activeNodeId);
  const isNavigatedDifferentFromActive = activePoint && navPoint && activePoint.node.id !== navPoint.node.id;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDownCanvas}
      onPointerMove={handlePointerMoveCanvas}
      onPointerUp={handlePointerUpCanvas}
      onPointerLeave={handlePointerUpCanvas}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#F5E6D8',
        position: 'relative',
        userSelect: 'none',
        cursor: isPanning ? 'grabbing' : 'grab'
      }}
      onClick={() => {
        if (!isPanning && radialNode) setRadialNode(null);
      }}
    >
      <div
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          transition: isPanning ? 'none' : 'transform 120ms ease-out',
          width: `${layout.width}px`,
          height: `${layout.height}px`,
          position: 'relative'
        }}
      >
        <svg
          width={layout.width}
          height={layout.height}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {/* Organic Flowing Curves */}
          {layout.edges.map((edge) => {
            if (edge.isDestabilized) {
              return (
                <g key={edge.id}>
                  {/* Subtle ethereal ghost track */}
                  <path
                    d={edge.pathD}
                    fill="none"
                    stroke="#8C7A6B"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.25"
                    className="wander-destabilized-edge-ghost"
                  />
                  {/* Dynamic destabilized crawling dotted path */}
                  <path
                    d={edge.pathD}
                    fill="none"
                    stroke="#181818"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="wander-destabilized-edge"
                  />
                </g>
              );
            }

            return (
              <path
                key={edge.id}
                d={edge.pathD}
                fill="none"
                stroke="#181818"
                strokeWidth="1.7"
                strokeDasharray={edge.isDashed ? '4 4' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={edge.isDashed ? 0.65 : 0.92}
              />
            );
          })}

          {/* Ongoing Growing Tip */}
          {layout.growingTip && layout.growingTip.isActive && (
            <g transform={`translate(${layout.growingTip.x}, ${layout.growingTip.y})`}>
              <circle
                cx="0"
                cy="0"
                r="3.5"
                fill="#181818"
                opacity="0.8"
              />
              <circle
                cx="0"
                cy="0"
                r="7"
                fill="none"
                stroke="#181818"
                strokeWidth="1"
                opacity="0.3"
              >
                <animate
                  attributeName="r"
                  values="4;10;4"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.5;0.1;0.5"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          )}

          {/* Start Anchor Node at bottom */}
          <g transform={`translate(${layout.startPoint.x}, ${layout.startPoint.y})`}>
            <circle cx="0" cy="0" r="5.5" fill="#181818" />
            <text
              x="0"
              y="22"
              textAnchor="middle"
              fill="#181818"
              fontSize="12px"
              fontWeight="600"
              fontFamily="inherit"
              letterSpacing="-0.01em"
            >
              Start
            </text>
          </g>

          {/* Subtle Ghost Shade (at Active Anchor when Navigating Away) */}
          {isNavigatedDifferentFromActive && activePoint && (
            <g transform={`translate(${activePoint.x}, ${activePoint.y})`}>
              <circle
                cx="0"
                cy="0"
                r="8.5"
                fill="none"
                stroke="#181818"
                strokeWidth="1"
                strokeDasharray="2 3"
                style={{ animation: 'ghostPulse 2.4s ease-in-out infinite' }}
              />
              {/* Soft connecting trace from active anchor to navigated position */}
              <line
                x1="0"
                y1="0"
                x2={navPoint.x - activePoint.x}
                y2={navPoint.y - activePoint.y}
                stroke="#181818"
                strokeWidth="1"
                strokeDasharray="3 4"
                opacity="0.18"
              />
            </g>
          )}

          {/* Nodes and Labels */}
          {layout.nodes.map((nodePoint) => {
            const { node, x, y, labelX, labelY, labelAlign, subtitle, durationLabel } = nodePoint;
            const isCompleted = node.status === 'COMPLETED';
            const isAbandoned = node.status === 'ABANDONED';
            const isActive = node.id === activeNodeId;

            return (
              <g
                key={node.id}
                data-node-interactive="true"
                onPointerDown={(e) => handleNodePointerDown(e, node, x, y)}
                style={{ cursor: 'pointer' }}
              >
                {/* Generous hit area for clicking and dragging */}
                <circle cx={x} cy={y} r="24" fill="transparent" />

                {/* Node Marker Shape */}
                {isCompleted ? (
                  // ● = Completed
                  <circle cx={x} cy={y} r="5" fill="#181818" />
                ) : isAbandoned ? (
                  // × = Abandoned
                  <g transform={`translate(${x}, ${y})`}>
                    <line x1="-4" y1="-4" x2="4" y2="4" stroke="#181818" strokeWidth="1.6" strokeLinecap="round" />
                    <line x1="-4" y1="4" x2="4" y2="-4" stroke="#181818" strokeWidth="1.6" strokeLinecap="round" />
                  </g>
                ) : (
                  // ○ = Ongoing
                  <>
                    <circle
                      cx={x}
                      cy={y}
                      r="5.5"
                      fill="#F5E6D8"
                      stroke="#181818"
                      strokeWidth="1.6"
                    />
                    {isActive && (
                      <circle cx={x} cy={y} r="2.2" fill="#181818" />
                    )}
                  </>
                )}

                {/* Node Label Text, Subtitle & Duration */}
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={labelAlign === 'right' ? 'end' : 'start'}
                  fill="#181818"
                  fontSize="12px"
                  fontWeight="500"
                  fontFamily="inherit"
                >
                  {node.title}
                  {(subtitle || durationLabel) && (
                    <tspan
                      x={labelX}
                      dy="14"
                      fill="#6A625A"
                      fontSize="10.5px"
                      fontWeight="400"
                    >
                      {[subtitle, durationLabel].filter(Boolean).join(' • ')}
                    </tspan>
                  )}
                </text>
              </g>
            );
          })}

          {/* Living Precision Needle Cursor (Subtle, Alive, Non-Intrusive Floating Pointer) */}
          {navPoint && (
            <g
              style={{
                transform: `translate(${navPoint.x}px, ${navPoint.y}px)`,
                transition: 'transform 320ms cubic-bezier(0.22, 1.25, 0.36, 1)',
                pointerEvents: 'none'
              }}
            >
              {/* Lissajous Harmonic Breathing Float */}
              <g style={{ animation: 'livingCursorFloat 3.2s ease-in-out infinite' }}>
                {/* Precision Ink Needle rotated 180° in clean bottom-left space, pointing ↗ with comfortable breathing room */}
                <path
                  d="M -26 26 L -15 15 M -15 15 L -21 15 M -15 15 L -15 21"
                  stroke="#181818"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="-13.5" cy="13.5" r="1.2" fill="#181818" />

                {/* Subtle Action Prompt when keyboard-navigated away from active focus */}
                {isNavigatedDifferentFromActive && (
                  <g transform="translate(-18, -21)">
                    <rect
                      x="-2"
                      y="-11"
                      width="68"
                      height="15"
                      rx="4"
                      fill="rgba(24, 24, 24, 0.88)"
                    />
                    <text
                      x="32"
                      y="0"
                      textAnchor="middle"
                      fill="#F5E6D8"
                      fontSize="9px"
                      fontWeight="500"
                      fontFamily="inherit"
                      letterSpacing="0.02em"
                    >
                      ↵ focus here
                    </text>
                  </g>
                )}
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* Spring Radial Bubble Action Menu */}
      {radialNode && (
        <RadialActionMenu
          node={radialNode.node}
          x={radialNode.x}
          y={radialNode.y}
          showShortcuts={radialNode.fromShift ?? false}
          onSelectAction={handleRadialAction}
          onClose={() => setRadialNode(null)}
        />
      )}

      {/* Discreet Legend in Bottom-Right Corner */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '28px',
          padding: '10px 14px',
          borderLeft: '1px solid #D5C6B8',
          fontSize: '11px',
          color: '#4A433D',
          lineHeight: '1.7',
          fontFamily: 'inherit',
          pointerEvents: 'none',
          backgroundColor: 'rgba(245, 230, 216, 0.72)',
          backdropFilter: 'blur(8px)',
          borderRadius: '4px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', lineHeight: 1 }}>●</span> = Completed
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', lineHeight: 1 }}>○</span> = Ongoing
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', lineHeight: 1 }}>×</span> = Abandoned
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          <span style={{ width: '16px', height: '1.5px', backgroundColor: '#181818', display: 'inline-block' }} />
          = One work path
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '16px',
              height: '1.5px',
              borderTop: '1.5px dashed #181818',
              display: 'inline-block'
            }}
          />
          = Dead end / dropped
        </div>
      </div>
    </div>
  );
};
