import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  onDeleteNode: (nodeId: string, fallbackNodeId?: string) => void;
  onStartNewWork: () => void;
  onNavigatedNodeChange?: (nodeId: string | null) => void;
  expandTrigger?: number;  // Increment to trigger centering on dock expand
  isContinuumMode?: boolean;
  isBranchLimitReached?: boolean;
  isParentTaskFinished?: boolean;
  onShowToast?: (message: string, durationMs?: number) => void;
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
  onNavigatedNodeChange,
  expandTrigger,
  isContinuumMode = false,
  isBranchLimitReached = false,
  isParentTaskFinished = false,
  onShowToast
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

  // Canvas hover & idle activity tracking (reduces opacity of non-main branches when main task is completed)
  const [isCanvasHoverActive, setIsCanvasHoverActive] = useState(false);
  const canvasActivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleCanvasPointerActivity = useCallback(() => {
    if (!isParentTaskFinished) return;
    setIsCanvasHoverActive(true);
    if (canvasActivityTimerRef.current) {
      clearTimeout(canvasActivityTimerRef.current);
    }
    canvasActivityTimerRef.current = setTimeout(() => {
      setIsCanvasHoverActive(false);
      canvasActivityTimerRef.current = null;
    }, 3000);
  }, [isParentTaskFinished]);

  const handleCanvasPointerLeave = useCallback(() => {
    if (!isParentTaskFinished) return;
    if (canvasActivityTimerRef.current) {
      clearTimeout(canvasActivityTimerRef.current);
      canvasActivityTimerRef.current = null;
    }
    setIsCanvasHoverActive(false);
  }, [isParentTaskFinished]);

  useEffect(() => {
    return () => {
      if (canvasActivityTimerRef.current) {
        clearTimeout(canvasActivityTimerRef.current);
      }
    };
  }, []);

  const isBranchDimmed = isParentTaskFinished && !isCanvasHoverActive;

  // Seamlessly focus camera and living cursor on last focused node ONLY when starting up or switching trees
  const activeTreeId = nodes[0]?.treeId || null;
  const initialTreeCenteredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeTreeId || !containerRef.current || layout.nodes.length === 0) return;
    if (initialTreeCenteredRef.current !== activeTreeId) {
      initialTreeCenteredRef.current = activeTreeId;
      const targetPoint = layout.nodes.find((n) => n.node.id === activeNodeId) || layout.nodes[0];
      if (targetPoint) {
        const rect = containerRef.current.getBoundingClientRect();
        const idealX = Math.round(rect.width / 2 - targetPoint.x);
        const idealY = Math.round(rect.height / 2 - targetPoint.y);
        setPanOffset({ x: idealX, y: idealY });
      }
    }
  }, [activeTreeId, layout.nodes]);

  // Center focused node ONLY when explicitly expanding from dock
  useEffect(() => {
    if (!expandTrigger || !containerRef.current || layout.nodes.length === 0) return;
    
    // Center on active, navigated, or first node
    const targetId = navigatedNodeId || activeNodeId || layout.nodes[0]?.node.id;
    const targetPoint = layout.nodes.find((n) => n.node.id === targetId) || layout.nodes[0];
    
    if (targetPoint) {
      // Add small delay to allow window expand animation to complete
      const timer = setTimeout(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const viewportWidth = rect.width > 200 ? rect.width : (window.innerWidth || 1150);
        const viewportHeight = rect.height > 200 ? rect.height : (window.innerHeight || 820);
        const idealX = Math.round(viewportWidth / 2 - targetPoint.x);
        const idealY = Math.round(viewportHeight / 2 - targetPoint.y);
        setPanOffset({ x: idealX, y: idealY });
      }, 350); // Wait for window expand animation
      return () => clearTimeout(timer);
    }
  }, [expandTrigger]);

  // Handle node deletion - only allow deletion if node has NO extended branches
  const executeDeleteNode = useCallback((targetId: string) => {
    const targetPoint = layout.nodes.find((n) => n.node.id === targetId);
    let fallbackId: string | undefined = undefined;

    // Check if target node has any child branches extending from it
    const children = layout.nodes.filter(
      (n) => n.node.parentNodeId === targetId
    );
    if (children.length > 0) {
      onShowToast?.('You cannot delete a node that has extended branches.', 6000);
      return;
    }

    if (targetPoint) {
      const parentId = targetPoint.node.parentNodeId;
      if (parentId) {
        // Find remaining sibling branches under the same parent
        const siblings = layout.nodes.filter(
          (n) => n.node.id !== targetId && n.node.parentNodeId === parentId
        );

        if (siblings.length > 0) {
          // Snap floating cursor to geometrically nearest sibling branch
          let minDistance = Infinity;
          let nearestSibling = siblings[0];

          for (const s of siblings) {
            const dist = Math.hypot(s.x - targetPoint.x, s.y - targetPoint.y);
            if (dist < minDistance) {
              minDistance = dist;
              nearestSibling = s;
            }
          }

          fallbackId = nearestSibling.node.id;
        } else {
          // No siblings exist; fall back to parent node
          fallbackId = parentId;
        }
      }
    }

    if (fallbackId) {
      updateNavigatedNode(fallbackId);
    }
    onDeleteNode(targetId, fallbackId);
  }, [layout.nodes, onDeleteNode, onShowToast]);

  // Spatial & Tree Keyboard Navigation Engine
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const isDialogActive = !!document.querySelector('[role="dialog"]');
      if (isInput || isDialogActive) return;

      if (layout.nodes.length === 0) return;

      const rootNodeId = nodes.find((n) => !n.parentNodeId)?.id || null;
      // Branches are locked when max branches reached OR main task is completed
      const isBranchLocked = isBranchLimitReached || isParentTaskFinished;

      const currentId = navigatedNodeId || activeNodeId || layout.nodes[0]?.node.id;
      const currentPoint = layout.nodes.find((n) => n.node.id === currentId) || layout.nodes[0];
      if (!currentPoint) return;

      // When Shift is pressed down, open the radial action menu on the current node with numbers
      if (e.key === 'Shift') {
        // Locked: only allow radial on root node
        if (isBranchLocked && currentPoint.node.id !== rootNodeId) return;
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
        // Locked: only allow actions on root node
        if (isBranchLocked && targetNode.id !== rootNodeId) return;
        setRadialNode(null);
        if (isOne) onOpenCommand('step', targetNode.id, targetNode.title);
        else if (isTwo) onOpenCommand('thought', targetNode.id, targetNode.title);
        else if (isThree) onSwitchFocus(targetNode.id);
        else if (isFour) onComplete(targetNode.id);
        else if (isFive) onAbandon(targetNode.id);
        else if (isSix) executeDeleteNode(targetNode.id);
        return;
      }

      // Delete or Backspace key deletes currently selected/navigated node
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const targetId = navigatedNodeId || activeNodeId;
        if (targetId) {
          // Locked: only allow delete on root node
          if (isBranchLocked && targetId !== rootNodeId) return;
          e.preventDefault();
          executeDeleteNode(targetId);
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
        // Locked: only allow focus switch to root node
        if (isBranchLocked && currentPoint.node.id !== rootNodeId) return;
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

      // Locked: arrow nav only navigates to root node
      const navCandidates = isBranchLocked
        ? layout.nodes.filter((n) => n.node.id === rootNodeId)
        : layout.nodes;

      if (isUp) {
        e.preventDefault();
        for (const p of navCandidates) {
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
        for (const p of navCandidates) {
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
        for (const p of navCandidates) {
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
        for (const p of navCandidates) {
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
  }, [navigatedNodeId, activeNodeId, layout.nodes, panOffset, onSwitchFocus, onOpenCommand, onComplete, onAbandon, executeDeleteNode, radialNode, isBranchLimitReached, nodes]);

  if (nodes.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          background: 'var(--background-canvas)',
          backgroundColor: 'var(--background)',
          color: 'var(--ink)',
          cursor: 'pointer',
          transition: 'var(--theme-transition)'
        }}
        onClick={onStartNewWork}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: isContinuumMode ? '#00E5FF' : 'var(--ink)',
              boxShadow: isContinuumMode ? '0 0 14px #00E5FF' : undefined
            }}
          />
          <span style={{ fontSize: '1.15rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
            Start
          </span>
          <span style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
            Click or press Ctrl+N to record where your attention begins
          </span>
        </div>
      </div>
    );
  }

  // Canvas Pan Handlers
  const handlePointerDownCanvas = (e: React.PointerEvent) => {
    handleCanvasPointerActivity();
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.dataset?.nodeInteractive === 'true' || target.closest('[data-node-interactive="true"]')) {
      return;
    }
    setIsPanning(true);
    startPanRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    handleCanvasPointerActivity();
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - startPanRef.current.x,
      y: e.clientY - startPanRef.current.y
    });
  };

  const handlePointerUpCanvas = () => {
    setIsPanning(false);
  };

  const handlePointerLeaveCanvas = () => {
    handleCanvasPointerLeave();
    setIsPanning(false);
  };

  // Node hold-and-drag gesture
  const handleNodePointerDown = (e: React.PointerEvent, node: Node, x: number, y: number) => {
    e.stopPropagation();
    handleCanvasPointerActivity();
    // Locked: only allow interaction on root node when branch limit reached or main task completed
    const rootNodeId = nodes.find((n) => !n.parentNodeId)?.id;
    if ((isBranchLimitReached || isParentTaskFinished) && node.id !== rootNodeId) return;
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
        executeDeleteNode(node.id);
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
      onPointerLeave={handlePointerLeaveCanvas}
      onPointerEnter={handleCanvasPointerActivity}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'transparent',
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
          <defs>
            {/* Minimal Understated Bioluminescent Glow Filter */}
            <filter id="continuum-glow-subtle" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="1.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Organic Flowing Curves */}
          {layout.edges.map((edge) => {
            const edgeDimmed = isBranchDimmed && !edge.isTrunk;

            if (edge.isDestabilized) {
              return (
                <g
                  key={edge.id}
                  style={{
                    opacity: edgeDimmed ? 0.15 : 1,
                    transition: 'opacity 500ms ease'
                  }}
                >
                  {/* Clean, quiet, dormant abandoned branch - serene muted starlight trace */}
                  <path
                    d={edge.pathD}
                    fill="none"
                    stroke={isContinuumMode ? 'rgba(251, 113, 133, 0.55)' : '#8C7A6B'}
                    strokeWidth={isContinuumMode ? '1.2' : '1.2'}
                    strokeDasharray={isContinuumMode ? '3 5' : '4 6'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={isContinuumMode ? 0.75 : 0.4}
                  />
                </g>
              );
            }

            if (isContinuumMode) {
              return (
                <g
                  key={edge.id}
                  style={{
                    opacity: edgeDimmed ? 0.15 : 1,
                    transition: 'opacity 500ms ease'
                  }}
                >
                  {/* Soft ethereal celestial aura glow */}
                  <path
                    d={edge.pathD}
                    fill="none"
                    stroke="rgba(56, 189, 248, 0.22)"
                    strokeWidth={edge.isDashed ? '2.2' : '2.8'}
                    strokeDasharray={edge.isDashed ? '3 5' : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#continuum-glow-subtle)"
                    opacity={edge.isDashed ? 0.4 : 0.65}
                  />
                  {/* Clean, elegant, luminous constellation fiber */}
                  <path
                    d={edge.pathD}
                    fill="none"
                    stroke={edge.isDashed ? 'rgba(186, 230, 253, 0.75)' : '#E0F2FE'}
                    strokeWidth={edge.isDashed ? '1.2' : '1.4'}
                    strokeDasharray={edge.isDashed ? '3 5' : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={edge.isDashed ? 0.8 : 0.95}
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
                opacity={edgeDimmed ? (edge.isDashed ? 0.1 : 0.15) : (edge.isDashed ? 0.65 : 0.92)}
                style={{ transition: 'opacity 500ms ease' }}
              />
            );
          })}

          {/* Ongoing Growing Tip */}
          {layout.growingTip && layout.growingTip.isActive && (
            <g
              transform={`translate(${layout.growingTip.x}, ${layout.growingTip.y})`}
              style={{
                opacity: isBranchDimmed ? 0.22 : 1,
                transition: 'opacity 500ms ease'
              }}
            >
              <circle
                cx="0"
                cy="0"
                r="3"
                fill={isContinuumMode ? '#38BDF8' : '#181818'}
                opacity="0.9"
              />
              <circle
                cx="0"
                cy="0"
                r="6.5"
                fill="none"
                stroke={isContinuumMode ? 'rgba(56, 189, 248, 0.7)' : '#181818'}
                strokeWidth={isContinuumMode ? '1.5' : '1'}
                opacity="0.6"
              >
                <animate
                  attributeName="r"
                  values="4;10;4"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.8;0.2;0.8"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          )}

          {/* Start Anchor Node at bottom */}
          <g transform={`translate(${layout.startPoint.x}, ${layout.startPoint.y})`}>
            <circle
              cx="0"
              cy="0"
              r={isContinuumMode ? '4' : '4.5'}
              fill={isContinuumMode ? '#38BDF8' : '#181818'}
            />
            {isContinuumMode && (
              <circle
                cx="0"
                cy="0"
                r="6.5"
                fill="none"
                stroke="rgba(56, 189, 248, 0.35)"
                strokeWidth="1"
              />
            )}
            <text
              x="0"
              y="20"
              textAnchor="middle"
              fill={isContinuumMode ? '#F8FAFC' : '#181818'}
              fontSize="12px"
              fontWeight="500"
              fontFamily="inherit"
              letterSpacing="-0.01em"
              style={{
                filter: isContinuumMode ? 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.9))' : undefined
              }}
            >
              Start
            </text>
          </g>

          {/* Subtle Ghost Shade (at Active Anchor when Navigating Away) */}
          {isNavigatedDifferentFromActive && activePoint && (
            <g
              transform={`translate(${activePoint.x}, ${activePoint.y})`}
              style={{
                opacity: isBranchDimmed ? 0.22 : 1,
                transition: 'opacity 500ms ease'
              }}
            >
              <circle
                cx="0"
                cy="0"
                r="8.5"
                fill="none"
                stroke={isContinuumMode ? '#38BDF8' : '#181818'}
                strokeWidth={isContinuumMode ? '1.4' : '1'}
                strokeDasharray="2 3"
                style={{ animation: 'ghostPulse 2.4s ease-in-out infinite' }}
              />
              {/* Soft connecting trace from active anchor to navigated position */}
              <line
                x1="0"
                y1="0"
                x2={navPoint.x - activePoint.x}
                y2={navPoint.y - activePoint.y}
                stroke={isContinuumMode ? '#38BDF8' : '#181818'}
                strokeWidth={isContinuumMode ? '1.4' : '1'}
                strokeDasharray="3 4"
                opacity={isContinuumMode ? '0.75' : '0.18'}
              />
            </g>
          )}

          {/* Nodes and Labels */}
          {layout.nodes.map((nodePoint) => {
            const { node, x, y, labelX, labelY, labelAlign, subtitle, durationLabel } = nodePoint;
            const isCompleted = node.status === 'COMPLETED';
            const isAbandoned = node.status === 'ABANDONED';
            const isActive = node.id === activeNodeId;
            const rootNodeId = nodes.find((n) => !n.parentNodeId)?.id;
            const isLockedByBranchLimit = (isBranchLimitReached || isParentTaskFinished) && node.id !== rootNodeId;

            return (
              <g
                key={node.id}
                data-node-interactive="true"
                onPointerDown={(e) => handleNodePointerDown(e, node, x, y)}
                style={{
                  cursor: isLockedByBranchLimit ? 'not-allowed' : 'pointer',
                  opacity: isLockedByBranchLimit ? 0.35 : (isBranchDimmed && !nodePoint.isTrunk) ? 0.22 : 1,
                  transition: 'opacity 500ms ease'
                }}
              >
                {/* Generous hit area for clicking and dragging */}
                <circle cx={x} cy={y} r="24" fill="transparent" />

                {/* Node Marker Shape */}
                {isCompleted ? (
                  // ● = Completed
                  <g>
                    <circle
                      cx={x}
                      cy={y}
                      r={isContinuumMode ? '4' : '4.5'}
                      fill={isContinuumMode ? '#38BDF8' : '#181818'}
                    />
                    {isContinuumMode && (
                      <circle
                        cx={x}
                        cy={y}
                        r="6"
                        fill="none"
                        stroke="rgba(56, 189, 248, 0.35)"
                        strokeWidth="1"
                      />
                    )}
                  </g>
                ) : isAbandoned ? (
                  // × = Abandoned
                  <g transform={`translate(${x}, ${y})`}>
                    <line
                      x1="-3"
                      y1="-3"
                      x2="3"
                      y2="3"
                      stroke={isContinuumMode ? '#FB7185' : '#181818'}
                      strokeWidth={isContinuumMode ? '1.3' : '1.5'}
                      strokeLinecap="round"
                      opacity={isContinuumMode ? 0.85 : 1}
                    />
                    <line
                      x1="-3"
                      y1="3"
                      x2="3"
                      y2="-3"
                      stroke={isContinuumMode ? '#FB7185' : '#181818'}
                      strokeWidth={isContinuumMode ? '1.3' : '1.5'}
                      strokeLinecap="round"
                      opacity={isContinuumMode ? 0.85 : 1}
                    />
                  </g>
                ) : (
                  // ○ = Ongoing
                  <>
                    <circle
                      cx={x}
                      cy={y}
                      r={isContinuumMode ? '4.5' : '5'}
                      fill={isContinuumMode ? '#070C14' : '#F5E6D8'}
                      stroke={isContinuumMode ? '#38BDF8' : '#181818'}
                      strokeWidth={isContinuumMode ? '1.3' : '1.4'}
                    />
                    {isActive && (
                      <>
                        <circle
                          cx={x}
                          cy={y}
                          r={isContinuumMode ? '2' : '2'}
                          fill={isContinuumMode ? '#38BDF8' : '#181818'}
                        />
                        {isContinuumMode && (
                          <circle
                            cx={x}
                            cy={y}
                            r="7.5"
                            fill="none"
                            stroke="rgba(56, 189, 248, 0.45)"
                            strokeWidth="1"
                            style={{ animation: 'continuumAuraRing 3.2s ease-out infinite' }}
                          />
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Node Label Text, Subtitle & Duration */}
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={labelAlign === 'right' ? 'end' : 'start'}
                  fill={isContinuumMode ? '#F8FAFC' : '#181818'}
                  fontSize="12px"
                  fontWeight={isContinuumMode ? '450' : '500'}
                  fontFamily="inherit"
                  letterSpacing="-0.01em"
                  style={{
                    filter: isContinuumMode
                      ? 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.9))'
                      : undefined
                  }}
                >
                  {node.title}
                  {(subtitle || durationLabel) && (
                    <tspan
                      x={labelX}
                      dy="14"
                      fill={isContinuumMode ? 'rgba(186, 230, 253, 0.85)' : '#6A625A'}
                      fontSize="10.5px"
                      fontWeight="400"
                      style={{
                        filter: isContinuumMode
                          ? 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9))'
                          : undefined
                      }}
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
                transition: 'transform 320ms cubic-bezier(0.22, 1.25, 0.36, 1), opacity 500ms ease',
                opacity: (isBranchDimmed && navPoint.node.parentNodeId) ? 0.35 : 1,
                pointerEvents: 'none'
              }}
            >
              {/* Lissajous Harmonic Breathing Float */}
              <g style={{ animation: 'livingCursorFloat 3.2s ease-in-out infinite' }}>
                {/* Precision Needle rotated 180° in clean bottom-left space, pointing ↗ with comfortable breathing room */}
                <path
                  d="M -26 26 L -15 15 M -15 15 L -21 15 M -15 15 L -15 21"
                  stroke={isContinuumMode ? '#38BDF8' : '#181818'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="-13.5"
                  cy="13.5"
                  r="1.2"
                  fill={isContinuumMode ? '#38BDF8' : '#181818'}
                />

                {/* Subtle Action Prompt when keyboard-navigated away from active focus */}
                {isNavigatedDifferentFromActive && (
                  <g transform="translate(-18, -21)">
                    <rect
                      x="-2"
                      y="-11"
                      width="72"
                      height="16"
                      rx="4"
                      fill={isContinuumMode ? '#070C14' : 'rgba(24, 24, 24, 0.88)'}
                      stroke={isContinuumMode ? 'rgba(56, 189, 248, 0.45)' : undefined}
                      strokeWidth={isContinuumMode ? '1' : undefined}
                    />
                    <text
                      x="34"
                      y="1"
                      textAnchor="middle"
                      fill={isContinuumMode ? '#F0F9FF' : '#F5E6D8'}
                      fontSize="9px"
                      fontWeight="600"
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
      {radialNode && (() => {
        const targetNodeChildren = nodes.filter(
          (n) => n.parentNodeId === radialNode.node.id && !n.deletedAt
        );
        const hasChildren = targetNodeChildren.length > 0;
        return (
          <RadialActionMenu
            node={radialNode.node}
            x={radialNode.x}
            y={radialNode.y}
            showShortcuts={radialNode.fromShift ?? false}
            isContinuumMode={isContinuumMode}
            isBranchLimitReached={isBranchLimitReached}
            isParentTaskFinished={isParentTaskFinished}
            hasChildren={hasChildren}
            onSelectAction={handleRadialAction}
            onClose={() => setRadialNode(null)}
          />
        );
      })()}

      {/* Discreet Legend in Bottom-Right Corner */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '28px',
          padding: '10px 14px',
          borderLeft: isContinuumMode ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid #D5C6B8',
          fontSize: '11px',
          color: isContinuumMode ? '#94A3B8' : '#4A433D',
          lineHeight: '1.7',
          fontFamily: 'inherit',
          pointerEvents: 'none',
          backgroundColor: isContinuumMode ? 'rgba(11, 16, 28, 0.75)' : 'rgba(245, 230, 216, 0.72)',
          backdropFilter: 'blur(10px)',
          borderRadius: '4px',
          transition: 'all 1600ms ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', lineHeight: 1, color: isContinuumMode ? '#38BDF8' : undefined }}>●</span> = Completed
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', lineHeight: 1, color: isContinuumMode ? '#38BDF8' : undefined }}>○</span> = Ongoing
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', lineHeight: 1, color: isContinuumMode ? '#FB7185' : undefined }}>×</span> = Abandoned
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          <span
            style={{
              width: '16px',
              height: '1.5px',
              backgroundColor: isContinuumMode ? '#FFFFFF' : '#181818',
              boxShadow: isContinuumMode ? '0 0 6px #38BDF8' : undefined,
              display: 'inline-block'
            }}
          />
          = One work path
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '16px',
              height: '1.5px',
              borderTop: isContinuumMode ? '1.5px dashed #38BDF8' : '1.5px dashed #181818',
              display: 'inline-block'
            }}
          />
          = Dead end / dropped
        </div>
      </div>
    </div>
  );
};
