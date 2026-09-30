import React, { useState, useEffect } from 'react';
import { History, SlidersHorizontal, Search, ArrowUpRight, Download, X, Trash2 } from 'lucide-react';
import { api, HistoryItemDTO } from '../../api/client';
import { AppSettings } from '../../domain/entities/types';
import { checkForAppUpdates, CURRENT_APP_VERSION } from '../../utils/updater';

interface SpotlightModalProps {
  isOpen: boolean;
  initialTab?: 'history' | 'settings';
  onClose: () => void;
  onResumeTree: (treeId: string) => void;
  showToast: (msg: string) => void;
  onRefreshContext?: () => void;
}

export const SpotlightModal: React.FC<SpotlightModalProps> = ({
  isOpen,
  initialTab = 'history',
  onClose,
  onResumeTree,
  showToast,
  onRefreshContext
}) => {
  const [tab, setTab] = useState<'history' | 'settings'>(initialTab);
  const [historyItems, setHistoryItems] = useState<HistoryItemDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    timeFormat: '12h',
    reducedMotion: false,
    highContrast: false
  });
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      api.history.list().then(setHistoryItems).catch(() => {});
      api.settings.get().then(setSettings).catch(() => {});
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleUpdateSettings = async (patch: Partial<AppSettings>) => {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    document.documentElement.setAttribute('data-reduced-motion', String(updated.reducedMotion));
    document.documentElement.setAttribute('data-high-contrast', String(updated.highContrast));
    await api.settings.save(patch);
    showToast('Preferences updated');
  };

  const handleExport = async () => {
    const data = await api.data.export();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attention-path-export.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export downloaded');
  };

  const handleDeleteTree = async (e: React.MouseEvent, treeId: string) => {
    e.stopPropagation();
    try {
      await api.trees.delete(treeId);
      showToast('Tree deleted from history');
      const updated = await api.history.list();
      setHistoryItems(updated);
      onRefreshContext?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete tree');
    }
  };

  const filteredHistory = historyItems.filter((item) =>
    (item.rootNode?.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'ACTIVE') {
      return {
        label: 'Active',
        bg: 'rgba(35, 131, 226, 0.08)',
        color: '#0B6ECA',
        border: 'rgba(35, 131, 226, 0.18)'
      };
    }
    if (s === 'COMPLETED') {
      return {
        label: 'Completed',
        bg: 'rgba(46, 125, 50, 0.08)',
        color: '#2E7D32',
        border: 'rgba(46, 125, 50, 0.18)'
      };
    }
    if (s === 'ABANDONED' || s === 'INTERRUPTED') {
      return {
        label: s === 'INTERRUPTED' ? 'Interrupted' : 'Dropped',
        bg: 'rgba(224, 62, 62, 0.08)',
        color: '#C13333',
        border: 'rgba(224, 62, 62, 0.18)'
      };
    }
    return {
      label: 'Paused',
      bg: 'rgba(0, 0, 0, 0.05)',
      color: '#787774',
      border: 'rgba(0, 0, 0, 0.08)'
    };
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(20, 18, 16, 0.38)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: '560px',
          height: '490px',
          maxWidth: '92vw',
          maxHeight: '85vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.18), 0 4px 16px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'notionFadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Tabs: Clean macOS / Notion Segmented Pill Track */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            backgroundColor: '#FAFAF9'
          }}
        >
          {/* Segmented control track */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              padding: '2px',
              borderRadius: '9px',
              gap: '2px'
            }}
          >
            <button
              onClick={() => setTab('history')}
              style={{
                fontSize: '12px',
                fontWeight: tab === 'history' ? 600 : 450,
                padding: '5px 12px',
                borderRadius: '7px',
                backgroundColor: tab === 'history' ? '#FFFFFF' : 'transparent',
                color: tab === 'history' ? '#1A1A1A' : '#787774',
                boxShadow: tab === 'history' ? '0 1px 3px rgba(0, 0, 0, 0.08), 0 0.5px 1px rgba(0, 0, 0, 0.04)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 120ms ease'
              }}
            >
              <History size={13} strokeWidth={2} />
              <span>History</span>
            </button>

            <button
              onClick={() => setTab('settings')}
              style={{
                fontSize: '12px',
                fontWeight: tab === 'settings' ? 600 : 450,
                padding: '5px 12px',
                borderRadius: '7px',
                backgroundColor: tab === 'settings' ? '#FFFFFF' : 'transparent',
                color: tab === 'settings' ? '#1A1A1A' : '#787774',
                boxShadow: tab === 'settings' ? '0 1px 3px rgba(0, 0, 0, 0.08), 0 0.5px 1px rgba(0, 0, 0, 0.04)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 120ms ease'
              }}
            >
              <SlidersHorizontal size={13} strokeWidth={2} />
              <span>Preferences</span>
            </button>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '6px',
              color: '#9B9A97',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'color 120ms ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#1A1A1A')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#9B9A97')}
            aria-label="Close"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Tab Content - Unified High-Grade Tone-on-Tone */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 18px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {tab === 'history' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              {/* Integrated Search Bar */}
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '6px'
                }}
              >
                <Search
                  size={14}
                  strokeWidth={2}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    color: '#9B9A97',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter past sessions..."
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    backgroundColor: 'rgba(0, 0, 0, 0.025)',
                    color: '#1A1A1A',
                    outline: 'none',
                    transition: 'all 120ms ease'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                    e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.2)';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 0, 0, 0.04)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.025)';
                    e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.08)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {filteredHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 0', color: '#9B9A97', fontSize: '13px' }}>
                  No sessions found.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {filteredHistory.map((item) => {
                    const isHovered = hoveredItemId === item.tree.id;
                    const badge = getStatusBadge(item.tree.status);

                    return (
                      <div
                        key={item.tree.id}
                        onMouseEnter={() => setHoveredItemId(item.tree.id)}
                        onMouseLeave={() => setHoveredItemId(null)}
                        onClick={() => {
                          onResumeTree(item.tree.id);
                          onClose();
                        }}
                        style={{
                          padding: '10px 12px',
                          backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'background-color 100ms ease'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 550, color: '#1A1A1A' }}>
                              {item.rootNode?.title || 'Untitled Work'}
                            </span>
                            {/* Refined Minimal Status Badge */}
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 500,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                                letterSpacing: '0.01em'
                              }}
                            >
                              {badge.label}
                            </span>
                          </div>

                          <div style={{ fontSize: '11px', color: '#9B9A97' }}>
                            {new Date(item.lastActivityAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} •{' '}
                            {item.nodeCount} node{item.nodeCount !== 1 ? 's' : ''}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            title="Delete this tree"
                            aria-label="Delete tree"
                            onClick={(e) => handleDeleteTree(e, item.tree.id)}
                            style={{
                              padding: '4px',
                              borderRadius: '4px',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#9B9A97',
                              opacity: isHovered ? 1 : 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 120ms ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#C13333';
                              e.currentTarget.style.backgroundColor = 'rgba(193, 51, 51, 0.08)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#9B9A97';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <Trash2 size={13} strokeWidth={2} />
                          </button>

                          <ArrowUpRight
                            size={14}
                            strokeWidth={2}
                            style={{
                              color: isHovered ? '#1A1A1A' : '#C4C3BE',
                              transition: 'color 100ms ease',
                              transform: isHovered ? 'translate(1px, -1px)' : 'none'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 550, color: '#1A1A1A' }}>Time Format</div>
                  <div style={{ fontSize: '11px', color: '#9B9A97' }}>Choose 12-hour or 24-hour timestamp display</div>
                </div>
                <select
                  value={settings.timeFormat}
                  onChange={(e) => handleUpdateSettings({ timeFormat: e.target.value as '12h' | '24h' })}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    backgroundColor: '#FFFFFF',
                    color: '#1A1A1A',
                    fontSize: '12px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="12h">12-hour</option>
                  <option value="24h">24-hour</option>
                </select>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 550, color: '#1A1A1A' }}>Reduced Motion</div>
                  <div style={{ fontSize: '11px', color: '#9B9A97' }}>Disable spring physics for instant canvas transitions</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.reducedMotion}
                  onChange={(e) => handleUpdateSettings({ reducedMotion: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: '#1A1A1A', cursor: 'pointer' }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 550, color: '#1A1A1A' }}>High Contrast</div>
                  <div style={{ fontSize: '11px', color: '#9B9A97' }}>Increase stroke boldness and text contrast across graph</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.highContrast}
                  onChange={(e) => handleUpdateSettings({ highContrast: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: '#1A1A1A', cursor: 'pointer' }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 550, color: '#1A1A1A' }}>App Updates</div>
                  <div style={{ fontSize: '11px', color: '#9B9A97' }}>
                    Attention Path v{CURRENT_APP_VERSION} {updateStatus && `• ${updateStatus}`}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setIsCheckingUpdate(true);
                    setUpdateStatus('Checking GitHub...');
                    try {
                      const res = await checkForAppUpdates();
                      if (res.isNewer) {
                        setUpdateStatus(`v${res.latestVersion} available!`);
                      } else {
                        setUpdateStatus('Up to date');
                      }
                    } catch {
                      setUpdateStatus('Check failed');
                    } finally {
                      setIsCheckingUpdate(false);
                    }
                  }}
                  disabled={isCheckingUpdate}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    backgroundColor: '#FFFFFF',
                    color: '#1A1A1A',
                    fontSize: '11.5px',
                    fontWeight: 500,
                    cursor: isCheckingUpdate ? 'wait' : 'pointer'
                  }}
                >
                  {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                </button>
              </div>

              <div style={{ paddingTop: '10px', display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleExport}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    backgroundColor: '#FAFAF9',
                    color: '#1A1A1A',
                    fontSize: '12px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 120ms ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FAFAF9')}
                >
                  <Download size={13} strokeWidth={2} />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Subtle Notion-Style Keyboard Helper Footer */}
        <div
          style={{
            padding: '8px 18px',
            borderTop: '1px solid rgba(0, 0, 0, 0.05)',
            backgroundColor: '#FAFAF9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#9B9A97',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span><kbd style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(0, 0, 0, 0.05)', border: '1px solid rgba(0, 0, 0, 0.08)', fontFamily: 'inherit' }}>↵</kbd> select</span>
            <span><kbd style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(0, 0, 0, 0.05)', border: '1px solid rgba(0, 0, 0, 0.08)', fontFamily: 'inherit' }}>esc</kbd> dismiss</span>
          </div>
          <span>Attention Path Spotlight</span>
        </div>
      </div>
    </div>
  );
};
