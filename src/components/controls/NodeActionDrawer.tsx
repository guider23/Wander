import React from 'react';
import { Node } from '../../domain/entities/types';

interface NodeActionDrawerProps {
  node: Node | null;
  isActiveFocus: boolean;
  onClose: () => void;
  onSwitchFocus: (nodeId: string) => void;
  onAddThought: (nodeId: string) => void;
  onAddStep: (nodeId: string) => void;
  onAddBranch: (nodeId: string) => void;
  onComplete: (nodeId: string) => void;
  onAbandon: (nodeId: string) => void;
  onRename: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onResumeContinuation?: (node: Node) => void;
}

export const NodeActionDrawer: React.FC<NodeActionDrawerProps> = ({
  node,
  isActiveFocus,
  onClose,
  onSwitchFocus,
  onAddThought,
  onAddStep,
  onAddBranch,
  onComplete,
  onAbandon,
  onRename,
  onDelete,
  onResumeContinuation
}) => {
  if (!node) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '80px',
        right: '24px',
        width: '320px',
        backgroundColor: 'var(--background-card)',
        border: '1.5px solid var(--ink)',
        borderRadius: 'var(--radius)',
        padding: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
      role="region"
      aria-label="Node actions"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ink)' }}>{node.title}</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '2px' }}>
            {node.kind} • {node.status} {isActiveFocus && '• Active Focus'}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close details"
          style={{
            color: 'var(--ink-secondary)',
            fontSize: '1.1rem',
            padding: '2px 6px',
            borderRadius: '4px'
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
        {!isActiveFocus && (
          <button
            onClick={() => onSwitchFocus(node.id)}
            style={{
              padding: '6px 10px',
              backgroundColor: 'var(--ink)',
              color: 'var(--background)',
              borderRadius: 'var(--radius)',
              fontSize: '0.85rem',
              fontWeight: 500,
              gridColumn: 'span 2'
            }}
          >
            Switch here
          </button>
        )}

        {onResumeContinuation && (
          <button
            onClick={() => onResumeContinuation(node)}
            style={{
              padding: '6px 10px',
              backgroundColor: 'var(--ink)',
              color: 'var(--background)',
              borderRadius: 'var(--radius)',
              fontSize: '0.85rem',
              fontWeight: 500,
              gridColumn: 'span 2'
            }}
          >
            Resume in new tree
          </button>
        )}

        <button
          onClick={() => onAddThought(node.id)}
          style={{
            padding: '6px 8px',
            backgroundColor: 'transparent',
            border: '1px solid var(--ink)',
            color: 'var(--ink)',
            borderRadius: 'var(--radius)',
            fontSize: '0.8rem',
            fontWeight: 500
          }}
        >
          + Thought
        </button>

        <button
          onClick={() => onAddStep(node.id)}
          style={{
            padding: '6px 8px',
            backgroundColor: 'transparent',
            border: '1px solid var(--ink)',
            color: 'var(--ink)',
            borderRadius: 'var(--radius)',
            fontSize: '0.8rem',
            fontWeight: 500
          }}
        >
          + Step
        </button>

        <button
          onClick={() => onAddBranch(node.id)}
          style={{
            padding: '6px 8px',
            backgroundColor: 'transparent',
            border: '1px solid var(--ink-border)',
            color: 'var(--ink)',
            borderRadius: 'var(--radius)',
            fontSize: '0.8rem',
            fontWeight: 500
          }}
        >
          + Branch
        </button>

        <button
          onClick={() => onRename(node.id)}
          style={{
            padding: '6px 8px',
            backgroundColor: 'transparent',
            border: '1px solid var(--ink-border)',
            color: 'var(--ink)',
            borderRadius: 'var(--radius)',
            fontSize: '0.8rem',
            fontWeight: 500
          }}
        >
          Rename
        </button>

        {node.status !== 'COMPLETED' && (
          <button
            onClick={() => onComplete(node.id)}
            style={{
              padding: '6px 8px',
              backgroundColor: 'transparent',
              border: '1px solid var(--ink-border)',
              color: 'var(--ink)',
              borderRadius: 'var(--radius)',
              fontSize: '0.8rem',
              fontWeight: 500
            }}
          >
            Complete
          </button>
        )}

        {node.status !== 'ABANDONED' && (
          <button
            onClick={() => onAbandon(node.id)}
            style={{
              padding: '6px 8px',
              backgroundColor: 'transparent',
              border: '1px solid var(--ink-border)',
              color: 'var(--ink-secondary)',
              borderRadius: 'var(--radius)',
              fontSize: '0.8rem',
              fontWeight: 500
            }}
          >
            Abandon
          </button>
        )}

        <button
          onClick={() => onDelete(node.id)}
          style={{
            padding: '6px 8px',
            backgroundColor: 'transparent',
            border: '1px solid var(--ink-border)',
            color: '#B00020',
            borderRadius: 'var(--radius)',
            fontSize: '0.8rem',
            fontWeight: 500,
            gridColumn: 'span 2'
          }}
        >
          Delete node
        </button>
      </div>
    </div>
  );
};
