import React from 'react';
import { Node } from '../../domain/entities/types';

interface AccessibleGraphListProps {
  nodes: Node[];
  activeNodeId: string | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export const AccessibleGraphList: React.FC<AccessibleGraphListProps> = ({
  nodes,
  activeNodeId,
  selectedNodeId,
  onSelectNode
}) => {
  if (nodes.length === 0) {
    return <div style={{ padding: '16px' }}>No items in graph.</div>;
  }

  // Build tree hierarchy
  const nodeMap = new Map<string, Node>();
  const childrenMap = new Map<string, Node[]>();

  for (const n of nodes) {
    nodeMap.set(n.id, n);
    childrenMap.set(n.id, []);
  }

  const roots: Node[] = [];
  for (const n of nodes) {
    if (!n.parentNodeId || !nodeMap.has(n.parentNodeId)) {
      roots.push(n);
    } else {
      childrenMap.get(n.parentNodeId)?.push(n);
    }
  }

  const renderNodeItem = (node: Node, level: number) => {
    const isActive = node.id === activeNodeId;
    const isSelected = node.id === selectedNodeId;
    const children = childrenMap.get(node.id) || [];

    return (
      <li
        key={node.id}
        style={{
          listStyle: 'none',
          paddingLeft: `${level * 20}px`,
          marginTop: '6px'
        }}
      >
        <button
          onClick={() => onSelectNode(node.id)}
          style={{
            textAlign: 'left',
            padding: '6px 10px',
            borderRadius: 'var(--radius)',
            backgroundColor: isSelected ? 'var(--background-card)' : 'transparent',
            border: isSelected ? '1px solid var(--ink)' : '1px solid transparent',
            color: 'var(--ink)',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          aria-current={isActive ? 'step' : undefined}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isActive ? 'var(--ink)' : 'transparent',
              border: '1.5px solid var(--ink)',
              display: 'inline-block'
            }}
          />
          <span style={{ fontWeight: isActive ? 600 : 400 }}>{node.title}</span>
          <span style={{ fontSize: '11px', color: 'var(--ink-muted)' }}>
            [{node.kind}] ({node.status.toLowerCase()})
            {isActive && ' — ACTIVE'}
          </span>
        </button>

        {children.length > 0 && (
          <ul style={{ margin: 0, padding: 0 }}>
            {children.map((child) => renderNodeItem(child, level + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav aria-label="Hierarchical list of attention nodes" style={{ padding: '16px' }}>
      <ul style={{ margin: 0, padding: 0 }}>
        {roots.map((root) => renderNodeItem(root, 0))}
      </ul>
    </nav>
  );
};
