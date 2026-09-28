import React, { useState, useEffect } from 'react';
import { api, HistoryItemDTO, TreeDetailDTO } from '../../api/client';
import { AttentionGraph } from '../../components/graph/AttentionGraph';
import { NodeActionDrawer } from '../../components/controls/NodeActionDrawer';
import { useUiStore } from '../../state/ui-store';
import { Node } from '../../domain/entities/types';

interface HistoryScreenProps {
  onSelectTreeToResume: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onSelectTreeToResume }) => {
  const [historyItems, setHistoryItems] = useState<HistoryItemDTO[]>([]);
  const [selectedTreeDetail, setSelectedTreeDetail] = useState<TreeDetailDTO | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { historyViewMode, setHistoryViewMode, showToast, setCurrentView } = useUiStore();

  const loadHistory = async () => {
    try {
      setLoading(true);
      const items = await api.history.list();
      setHistoryItems(items);
    } catch (err: any) {
      showToast(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSelectTree = async (treeId: string) => {
    try {
      const detail = await api.trees.getTree(treeId);
      setSelectedTreeDetail(detail);
      setSelectedNodeId(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to load tree details');
    }
  };

  const handleResumeContinuation = async (node: Node) => {
    try {
      await api.sessions.resumeContinuation(node.treeId, node.id, `Continue: ${node.title}`);
      showToast('Started continuation tree');
      onSelectTreeToResume();
      setCurrentView('now');
    } catch (err: any) {
      showToast(err.message || 'Failed to resume node');
    }
  };

  const handleDeleteTree = async (treeId: string) => {
    if (!confirm('Are you sure you want to delete this session tree?')) return;
    try {
      await api.trees.delete(treeId);
      showToast('Deleted tree');
      setSelectedTreeDetail(null);
      loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete');
    }
  };

  // Group by date
  const groupedByDay = historyItems.reduce((acc, item) => {
    const dateStr = new Date(item.lastActivityAt).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(item);
    return acc;
  }, {} as Record<string, HistoryItemDTO[]>);

  const selectedNode = selectedTreeDetail?.nodes.find((n) => n.id === selectedNodeId) || null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };

  if (selectedTreeDetail) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => setSelectedTreeDetail(null)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--ink-border)',
                backgroundColor: 'transparent',
                color: 'var(--ink)',
                fontSize: '0.85rem'
              }}
            >
              ← Back to History
            </button>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--ink)' }}>
                {selectedTreeDetail.nodes.find((n) => n.id === selectedTreeDetail.tree.rootNodeId)?.title || 'Tree Details'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)' }}>
                {selectedTreeDetail.tree.status} • {selectedTreeDetail.nodes.length} nodes •{' '}
                {new Date(selectedTreeDetail.tree.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ border: '1px solid var(--ink-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <button
                onClick={() => setHistoryViewMode('graph')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: historyViewMode === 'graph' ? 'var(--ink)' : 'transparent',
                  color: historyViewMode === 'graph' ? 'var(--background)' : 'var(--ink)',
                  fontSize: '0.8rem'
                }}
              >
                Graph
              </button>
              <button
                onClick={() => setHistoryViewMode('timeline')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: historyViewMode === 'timeline' ? 'var(--ink)' : 'transparent',
                  color: historyViewMode === 'timeline' ? 'var(--background)' : 'var(--ink)',
                  fontSize: '0.8rem'
                }}
              >
                Timeline
              </button>
            </div>

            <button
              onClick={() => handleDeleteTree(selectedTreeDetail.tree.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid #B00020',
                color: '#B00020',
                backgroundColor: 'transparent',
                fontSize: '0.8rem'
              }}
            >
              Delete
            </button>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {historyViewMode === 'graph' ? (
            <AttentionGraph
              nodes={selectedTreeDetail.nodes}
              activeNodeId={null}
              selectedNodeId={selectedNodeId}
              onSelectNode={(id) => setSelectedNodeId(id)}
            />
          ) : (
            <div style={{ padding: '24px', overflowY: 'auto', height: '100%' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px' }}>Attention Timeline</h3>
              <ol style={{ listStyle: 'none', borderLeft: '2px solid var(--ink)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {selectedTreeDetail.sessions.map((s) => {
                  const node = selectedTreeDetail.nodes.find((n) => n.id === s.focusNodeId);
                  const time = new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <li key={s.id} style={{ position: 'relative' }}>
                      <span
                        style={{
                          position: 'absolute',
                          left: '-23px',
                          top: '4px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--ink)',
                          border: '2px solid var(--background)'
                        }}
                      />
                      <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{time}</div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>
                        {node?.title || 'Unknown node'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)' }}>
                        Status: {s.status.toLowerCase()}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Node Action Drawer with Resume Continuation */}
          <NodeActionDrawer
            node={selectedNode}
            isActiveFocus={false}
            onClose={() => setSelectedNodeId(null)}
            onSwitchFocus={() => {}}
            onAddThought={() => {}}
            onAddStep={() => {}}
            onAddBranch={() => {}}
            onComplete={() => {}}
            onAbandon={() => {}}
            onRename={() => {}}
            onDelete={() => {}}
            onResumeContinuation={handleResumeContinuation}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)' }}>History</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)', marginTop: '2px' }}>
          Past work sessions and attention paths
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--ink-muted)' }}>Loading history...</p>
      ) : historyItems.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-secondary)' }}>
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>No history recorded yet.</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginTop: '4px' }}>
            Complete or pause work sessions to see them organized here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {Object.entries(groupedByDay).map(([day, items]) => (
            <section key={day}>
              <h3
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--ink-muted)',
                  marginBottom: '10px'
                }}
              >
                {day}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map((item) => (
                  <div
                    key={item.tree.id}
                    onClick={() => handleSelectTree(item.tree.id)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSelectTree(item.tree.id);
                    }}
                    style={{
                      padding: '14px 18px',
                      backgroundColor: 'var(--background-card)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--ink-border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)' }}>
                          {item.rootNode?.title || 'Work'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            borderRadius: '10px',
                            border: '1px solid var(--ink-border)',
                            color: 'var(--ink-secondary)'
                          }}
                        >
                          {item.tree.status}
                        </span>
                        {item.tree.relationshipType === 'CONTINUATION' && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '1px 6px',
                              borderRadius: '10px',
                              backgroundColor: 'var(--background)',
                              color: 'var(--ink-secondary)'
                            }}
                          >
                            Continuation
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '4px' }}>
                        {item.nodeCount} node{item.nodeCount !== 1 ? 's' : ''} • {item.sessionCount} session
                        {item.sessionCount !== 1 ? 's' : ''} • {formatDuration(item.totalDurationSeconds)}
                      </p>
                    </div>

                    <span style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>View →</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
