import React, { useEffect, useState } from 'react';
import { AttentionGraph } from '../../components/graph/AttentionGraph';
import { AccessibleGraphList } from '../../components/graph/AccessibleGraphList';
import { NodeActionDrawer } from '../../components/controls/NodeActionDrawer';
import { useUiStore } from '../../state/ui-store';
import { api, ActiveContextDTO } from '../../api/client';

interface NowScreenProps {
  context: ActiveContextDTO;
  onRefresh: () => void;
}

export const NowScreen: React.FC<NowScreenProps> = ({ context, onRefresh }) => {
  const {
    selectedNodeId,
    setSelectedNodeId,
    openModal,
    isAccessibleListView,
    showToast
  } = useUiStore();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const activeTree = context.activeTree;
  const activeSession = context.activeSession;
  const activeNode = context.activeNode;
  const nodes = context.nodes;

  const isPaused = activeTree?.status === 'PAUSED' || !activeSession;

  // Session timer
  useEffect(() => {
    if (!activeSession || isPaused) return;
    const startTime = new Date(activeSession.startedAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - startTime) / 1000));
      setElapsedSeconds(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSession, isPaused]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        openModal('startWork');
      } else if (e.key.toLowerCase() === 't' && !e.ctrlKey) {
        if (activeNode) {
          e.preventDefault();
          openModal('thought', activeNode.id);
        }
      } else if (e.key.toLowerCase() === 's' && !e.ctrlKey) {
        if (activeNode) {
          e.preventDefault();
          openModal('step', activeNode.id);
        }
      } else if (e.key === 'Escape') {
        setSelectedNodeId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeNode, openModal, setSelectedNodeId]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const handlePauseResume = async () => {
    try {
      if (isPaused) {
        if (activeTree) {
          await api.sessions.resume(activeTree.id, selectedNodeId || activeTree.rootNodeId);
          showToast('Session resumed');
          onRefresh();
        }
      } else {
        await api.sessions.pause();
        showToast('Session paused');
        onRefresh();
      }
    } catch (err: any) {
      showToast(err.message || 'Action failed');
    }
  };

  const handleSwitchFocus = async (nodeId: string) => {
    try {
      await api.sessions.switchFocus(nodeId);
      showToast('Switched focus');
      setSelectedNodeId(null);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Could not switch focus');
    }
  };

  const handleCompleteNode = async (nodeId: string) => {
    try {
      await api.nodes.complete(nodeId);
      showToast('Completed');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to complete node');
    }
  };

  const handleAbandonNode = async (nodeId: string) => {
    openModal('abandon', nodeId);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins % 60}m`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Top Header */}
      <header
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--ink-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--background)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)' }}>
              {activeTree ? (nodes.find((n) => n.id === activeTree.rootNodeId)?.title || 'Current Work') : 'No Active Work'}
            </h2>
            {activeTree && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid var(--ink-border)',
                  color: isPaused ? 'var(--ink-muted)' : 'var(--ink)',
                  fontWeight: 500
                }}
              >
                {isPaused ? 'PAUSED' : 'ACTIVE'}
              </span>
            )}
            {activeTree?.relationshipType === 'CONTINUATION' && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--background-card)',
                  color: 'var(--ink-secondary)',
                  fontWeight: 500
                }}
              >
                Continuation
              </span>
            )}
          </div>
          {activeNode && (
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)', marginTop: '4px' }}>
              Focus: <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{activeNode.title}</span>
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {!isPaused && activeSession && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '1rem',
                color: 'var(--ink)',
                fontWeight: 600
              }}
            >
              {formatTimer(elapsedSeconds)}
            </span>
          )}

          <button
            onClick={() => openModal('startWork')}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--ink)',
              backgroundColor: 'transparent',
              color: 'var(--ink)',
              fontSize: '0.85rem',
              fontWeight: 500
            }}
          >
            Start new work
          </button>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {nodes.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '12px'
            }}
          >
            <p style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--ink)' }}>
              No work logged yet.
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)', marginBottom: '8px' }}>
              Start something and see where your attention goes.
            </p>
            <button
              onClick={() => openModal('startWork')}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--ink)',
                color: 'var(--background)',
                fontWeight: 600,
                fontSize: '0.95rem'
              }}
            >
              Start work
            </button>
          </div>
        ) : isAccessibleListView ? (
          <AccessibleGraphList
            nodes={nodes}
            activeNodeId={activeNode?.id || null}
            selectedNodeId={selectedNodeId}
            onSelectNode={(id) => setSelectedNodeId(id)}
          />
        ) : (
          <AttentionGraph
            nodes={nodes}
            activeNodeId={activeNode?.id || null}
            selectedNodeId={selectedNodeId}
            onSelectNode={(id) => setSelectedNodeId(id)}
          />
        )}

        {/* Selected Node Action Drawer */}
        <NodeActionDrawer
          node={selectedNode}
          isActiveFocus={activeNode?.id === selectedNode?.id}
          onClose={() => setSelectedNodeId(null)}
          onSwitchFocus={handleSwitchFocus}
          onAddThought={(id) => openModal('thought', id)}
          onAddStep={(id) => openModal('step', id)}
          onAddBranch={(id) => openModal('step', id)}
          onComplete={handleCompleteNode}
          onAbandon={handleAbandonNode}
          onRename={(id) => openModal('rename', id)}
          onDelete={(id) => openModal('delete', id)}
        />
      </main>

      {/* Bottom Floating Action Bar */}
      {nodes.length > 0 && (
        <footer
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--ink-border)',
            backgroundColor: 'var(--background-card)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => openModal('thought', activeNode?.id || activeTree?.rootNodeId)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--ink)',
                color: 'var(--background)',
                fontSize: '0.85rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Capture thought (T)"
            >
              + Thought
            </button>

            <button
              onClick={() => openModal('step', activeNode?.id || activeTree?.rootNodeId)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--ink)',
                backgroundColor: 'transparent',
                color: 'var(--ink)',
                fontSize: '0.85rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Add sequential step (S)"
            >
              + Step
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {activeNode && activeNode.status !== 'COMPLETED' && (
              <button
                onClick={() => handleCompleteNode(activeNode.id)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--ink-border)',
                  backgroundColor: 'transparent',
                  color: 'var(--ink)',
                  fontSize: '0.85rem'
                }}
              >
                Complete current
              </button>
            )}

            <button
              onClick={handlePauseResume}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--ink)',
                backgroundColor: isPaused ? 'var(--ink)' : 'transparent',
                color: isPaused ? 'var(--background)' : 'var(--ink)',
                fontSize: '0.85rem',
                fontWeight: 500
              }}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};
