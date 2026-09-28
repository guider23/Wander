import React, { useMemo } from 'react';
import { Node } from '../../domain/entities/types';
import { layoutGraph } from '../../graph/layout';

interface AttentionGraphProps {
  nodes: Node[];
  activeNodeId: string | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export const AttentionGraph: React.FC<AttentionGraphProps> = ({
  nodes,
  activeNodeId,
  selectedNodeId,
  onSelectNode
}) => {
  const layout = useMemo(() => {
    return layoutGraph(nodes, activeNodeId, {
      viewportWidth: 960,
      nodeSpacingY: 84,
      branchSpacingX: 240
    });
  }, [nodes, activeNodeId]);

  if (nodes.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--ink-secondary)',
          textAlign: 'center',
          padding: '24px'
        }}
      >
        <p style={{ fontSize: '1.25rem', marginBottom: '8px', fontWeight: 500 }}>
          No work logged yet.
        </p>
        <p style={{ fontSize: '0.95rem', color: 'var(--ink-muted)' }}>
          Start something and see where your attention goes.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        position: 'relative',
        padding: '20px'
      }}
      tabIndex={0}
      aria-label="Attention graph canvas"
    >
      <svg
        width={layout.width}
        height={layout.height}
        style={{ minWidth: '100%', display: 'block' }}
      >
        {/* Subtle trunk guide line */}
        <line
          x1={layout.trunkX}
          y1={40}
          x2={layout.trunkX}
          y2={layout.height - 40}
          stroke="var(--ink-border)"
          strokeWidth="1"
          strokeDasharray="2 6"
          opacity="0.6"
        />

        {/* Edges */}
        {layout.edges.map((edge) => {
          const isAbandoned = edge.status === 'ABANDONED';
          const isActive = edge.status === 'ACTIVE';

          return (
            <path
              key={edge.id}
              d={edge.pathD}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={isActive ? '2.4' : '1.75'}
              strokeDasharray={isAbandoned ? '4 4' : undefined}
              opacity={isAbandoned ? 0.35 : isActive ? 1 : 0.75}
              style={{
                transition: 'stroke-width 200ms ease, opacity 200ms ease'
              }}
            />
          );
        })}

        {/* Nodes */}
        {layout.nodes.map(({ node, x, y, isTrunk }) => {
          const isActive = node.id === activeNodeId;
          const isSelected = node.id === selectedNodeId;
          const isCompleted = node.status === 'COMPLETED';
          const isAbandoned = node.status === 'ABANDONED';
          const isPaused = node.status === 'PAUSED';

          return (
            <g
              key={node.id}
              transform={`translate(${x}, ${y})`}
              onClick={() => onSelectNode(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectNode(node.id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${node.title} (${node.kind}, status: ${node.status}${isActive ? ', active' : ''})`}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              {/* Selection indicator halo */}
              {isSelected && (
                <rect
                  x="-18"
                  y="-18"
                  width="220"
                  height="36"
                  rx="18"
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  opacity="0.8"
                />
              )}

              {/* Node Endpoint Shape */}
              {isActive ? (
                <>
                  <circle
                    cx="0"
                    cy="0"
                    r="9"
                    fill="var(--background)"
                    stroke="var(--ink)"
                    strokeWidth="2.5"
                  />
                  <circle cx="0" cy="0" r="4.5" fill="var(--ink)" />
                </>
              ) : isCompleted ? (
                <circle cx="0" cy="0" r="5.5" fill="var(--ink)" />
              ) : isAbandoned ? (
                <>
                  <circle
                    cx="0"
                    cy="0"
                    r="5.5"
                    fill="var(--background)"
                    stroke="var(--ink-muted)"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                  <line
                    x1="-3"
                    y1="-3"
                    x2="3"
                    y2="3"
                    stroke="var(--ink-muted)"
                    strokeWidth="1.2"
                  />
                  <line
                    x1="-3"
                    y1="3"
                    x2="3"
                    y2="-3"
                    stroke="var(--ink-muted)"
                    strokeWidth="1.2"
                  />
                </>
              ) : isPaused ? (
                <>
                  <circle
                    cx="0"
                    cy="0"
                    r="6"
                    fill="var(--background)"
                    stroke="var(--ink-secondary)"
                    strokeWidth="1.5"
                  />
                  <circle cx="0" cy="0" r="2" fill="var(--ink-secondary)" />
                </>
              ) : (
                /* Ongoing open circle */
                <circle
                  cx="0"
                  cy="0"
                  r="6"
                  fill="var(--background)"
                  stroke="var(--ink)"
                  strokeWidth="1.75"
                />
              )}

              {/* Node Title & Metadata */}
              <text
                x="16"
                y="4.5"
                fill="var(--ink)"
                fontSize="14px"
                fontWeight={isActive ? '600' : isTrunk ? '500' : '400'}
                opacity={isAbandoned ? 0.45 : 1}
                style={{
                  fontFamily: 'var(--font-family)',
                  letterSpacing: '-0.01em'
                }}
              >
                {node.title.length > 28 ? `${node.title.slice(0, 26)}…` : node.title}
              </text>

              {/* Thought/Return tag badge */}
              {node.kind === 'THOUGHT' && (
                <text
                  x="16"
                  y="18"
                  fill="var(--ink-muted)"
                  fontSize="10px"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
                >
                  Thought
                </text>
              )}
              {node.kind === 'RETURN_ANCHOR' && (
                <text
                  x="16"
                  y="18"
                  fill="var(--ink-muted)"
                  fontSize="10px"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
                >
                  Resumed
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
