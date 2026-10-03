import React, { useState, useEffect } from 'react';
import { History, SlidersHorizontal, Search, ArrowUpRight, Download, X, Trash2, FolderOpen, Cloud, RefreshCw, BookOpen, Lightbulb, CornerDownRight, Compass, Lock, GitBranch, ShieldCheck } from 'lucide-react';
import { api, HistoryItemDTO } from '../../api/client';
import { AppSettings } from '../../domain/entities/types';
import { checkForAppUpdates, getCurrentAppVersion, UpdateInfo } from '../../utils/updater';
import galaxyBg from '../../assets/galaxy-bg.jpg';

interface SpotlightModalProps {
  isOpen: boolean;
  initialTab?: 'history' | 'model' | 'settings';
  onClose: () => void;
  onResumeTree: (treeId: string) => void;
  showToast: (msg: string) => void;
  onRefreshContext?: () => void;
  onSettingsChange?: () => void;
}

export const SpotlightModal: React.FC<SpotlightModalProps> = ({
  isOpen,
  initialTab = 'history',
  onClose,
  onResumeTree,
  showToast,
  onRefreshContext,
  onSettingsChange
}) => {
  const [tab, setTab] = useState<'history' | 'model' | 'settings'>(initialTab);
  const [historyItems, setHistoryItems] = useState<HistoryItemDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    timeFormat: '12h',
    reducedMotion: false,
    highContrast: false
  });
  const [currentAppVersion, setCurrentAppVersion] = useState<string>('1.0.2');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    stage: 'idle' | 'downloading' | 'downloaded' | 'installing' | 'error';
    percent: number;
    transferredMB: string;
    totalMB: string;
    error?: string;
  }>({
    stage: 'idle',
    percent: 0,
    transferredMB: '0',
    totalMB: '0'
  });

  const [gdriveStatus, setGdriveStatus] = useState<{ isConnected: boolean; email?: string; lastSyncAt?: string }>({ isConnected: false });
  const [isConnectingGdrive, setIsConnectingGdrive] = useState(false);
  const [isSyncingGdrive, setIsSyncingGdrive] = useState(false);
  const [isRestoringCloud, setIsRestoringCloud] = useState(false);
  const [cloudRestorePrompt, setCloudRestorePrompt] = useState<{
    backupId: string;
    backupName: string;
    backupDate?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      api.history.list().then(setHistoryItems).catch(() => {});
      api.settings.get().then(setSettings).catch(() => {});
      getCurrentAppVersion().then(setCurrentAppVersion).catch(() => {});
      api.gdrive.getStatus().then(setGdriveStatus).catch(() => {});

      const unsub = api.updater.onProgress((status) => {
        const transferredMB = ((status.transferredBytes || 0) / (1024 * 1024)).toFixed(1);
        const totalMB = ((status.totalBytes || 0) / (1024 * 1024)).toFixed(1);
        setDownloadProgress({
          stage: status.stage,
          percent: status.downloadPercent || 0,
          transferredMB,
          totalMB,
          error: status.error
        });
        if (status.stage === 'downloaded') {
          setUpdateStatus('Installing & restarting...');
          api.updater.install(updateInfo?.downloadUrl);
        }
      });
      return () => unsub();
    }
  }, [isOpen, initialTab, updateInfo?.downloadUrl]);

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
    onSettingsChange?.();
    showToast('Preferences updated');
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
        bg: 'rgba(24, 24, 24, 0.07)',
        color: '#181818',
        border: 'rgba(24, 24, 24, 0.18)'
      };
    }
    if (s === 'COMPLETED') {
      return {
        label: 'Completed',
        bg: 'rgba(0, 0, 0, 0.04)',
        color: '#4B4945',
        border: 'rgba(0, 0, 0, 0.12)'
      };
    }
    if (s === 'ABANDONED' || s === 'INTERRUPTED') {
      return {
        label: s === 'INTERRUPTED' ? 'Interrupted' : 'Dropped',
        bg: 'rgba(0, 0, 0, 0.03)',
        color: '#787774',
        border: 'rgba(0, 0, 0, 0.08)'
      };
    }
    return {
      label: 'Paused',
      bg: 'rgba(0, 0, 0, 0.03)',
      color: '#9B9A97',
      border: 'rgba(0, 0, 0, 0.06)'
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
          width: '600px',
          height: '540px',
          maxWidth: '92vw',
          maxHeight: '88vh',
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
              onClick={() => setTab('model')}
              style={{
                fontSize: '12px',
                fontWeight: tab === 'model' ? 600 : 450,
                padding: '5px 12px',
                borderRadius: '7px',
                backgroundColor: tab === 'model' ? '#FFFFFF' : 'transparent',
                color: tab === 'model' ? '#1A1A1A' : '#787774',
                boxShadow: tab === 'model' ? '0 1px 3px rgba(0, 0, 0, 0.08), 0 0.5px 1px rgba(0, 0, 0, 0.04)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 120ms ease'
              }}
            >
              <BookOpen size={13} strokeWidth={2} />
              <span>Mental Model</span>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {filteredHistory.map((item) => {
                    const isHovered = hoveredItemId === item.tree.id;
                    const isCompleted =
                      (item.tree.status || '').toUpperCase() === 'COMPLETED' ||
                      (item.rootNode?.status || '').toUpperCase() === 'COMPLETED';
                    const effectiveStatus = isCompleted ? 'COMPLETED' : item.tree.status;
                    const badge = getStatusBadge(effectiveStatus);

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
                          position: 'relative',
                          padding: '11px 14px',
                          borderRadius: '10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          border: isCompleted
                            ? '1px solid rgba(56, 189, 248, 0.22)'
                            : isHovered
                            ? '1px solid rgba(0, 0, 0, 0.08)'
                            : '1px solid transparent',
                          boxShadow: isCompleted
                            ? isHovered
                              ? '0 6px 20px rgba(0, 0, 0, 0.35), 0 0 12px rgba(56, 189, 248, 0.2)'
                              : '0 2px 10px rgba(0, 0, 0, 0.2)'
                            : 'none',
                          backgroundColor: isCompleted
                            ? '#050D1A'
                            : isHovered
                            ? 'rgba(0, 0, 0, 0.04)'
                            : 'transparent',
                          transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      >
                        {/* Cropped Cosmic Galaxy Background Layer for Completed Trees */}
                        {isCompleted && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              backgroundImage: `url(${galaxyBg})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center 40%',
                              opacity: isHovered ? 1 : 0.95,
                              pointerEvents: 'none',
                              zIndex: 0,
                              transition: 'opacity 180ms ease'
                            }}
                          >
                            {/* Balanced cosmic vignette: preserve luminous nebula blues, cyans and purples */}
                            <div
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: isHovered
                                  ? 'linear-gradient(90deg, rgba(5, 13, 26, 0.40) 0%, rgba(5, 13, 26, 0.15) 60%, rgba(5, 13, 26, 0.35) 100%)'
                                  : 'linear-gradient(90deg, rgba(5, 13, 26, 0.48) 0%, rgba(5, 13, 26, 0.22) 60%, rgba(5, 13, 26, 0.40) 100%)',
                                transition: 'background 180ms ease'
                              }}
                            />
                          </div>
                        )}

                        {/* Card Content (Relative z-index 1 above cosmic canvas) */}
                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: isCompleted ? '#F8FAFC' : '#1A1A1A',
                                letterSpacing: '-0.01em',
                                textShadow: isCompleted ? '0 1px 3px rgba(0, 0, 0, 0.7)' : 'none'
                              }}
                            >
                              {item.rootNode?.title || 'Untitled Work'}
                            </span>
                            {/* Refined Minimal Status Badge */}
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 500,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: isCompleted ? 'rgba(56, 189, 248, 0.22)' : badge.bg,
                                color: isCompleted ? '#BAE6FD' : badge.color,
                                border: isCompleted ? '1px solid rgba(56, 189, 248, 0.45)' : `1px solid ${badge.border}`,
                                letterSpacing: '0.01em',
                                backdropFilter: isCompleted ? 'blur(4px)' : 'none'
                              }}
                            >
                              {badge.label}
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: '11px',
                              color: isCompleted ? '#CBD5E1' : '#9B9A97',
                              textShadow: isCompleted ? '0 1px 2px rgba(0, 0, 0, 0.6)' : 'none'
                            }}
                          >
                            {new Date(item.lastActivityAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} •{' '}
                            {item.nodeCount} node{item.nodeCount !== 1 ? 's' : ''}
                            {isCompleted && ' • Cosmic Continuum'}
                          </div>
                        </div>

                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                              color: isCompleted ? '#94A3B8' : '#9B9A97',
                              opacity: isHovered ? 1 : 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 120ms ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#F87171';
                              e.currentTarget.style.backgroundColor = isCompleted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(193, 51, 51, 0.08)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = isCompleted ? '#94A3B8' : '#9B9A97';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <Trash2 size={13} strokeWidth={2} />
                          </button>

                          <ArrowUpRight
                            size={14}
                            strokeWidth={2}
                            style={{
                              color: isCompleted ? (isHovered ? '#FFFFFF' : '#94A3B8') : (isHovered ? '#1A1A1A' : '#C4C3BE'),
                              transition: 'all 100ms ease',
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
          ) : tab === 'model' ? (
            /* Tab: Mental Model & Botanical Guide - High-Grade Monochrome Botanical Architecture */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '4px 2px'
              }}
            >
              {/* Botanical Schematic Diagram Card with Tree Anatomy */}
              <div
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  borderRadius: '12px',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Compass size={15} strokeWidth={2} style={{ color: '#181818' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#181818', letterSpacing: '-0.01em' }}>
                      Botanical Attention Architecture
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(0, 0, 0, 0.05)',
                      color: '#4B4945',
                      border: '1px solid rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    Living Tree Philosophy
                  </span>
                </div>

                <p style={{ fontSize: '12px', color: '#57534E', lineHeight: 1.6, margin: 0 }}>
                  Wander treats your human focus like a growing botanical tree. When you start work, you plant a single <strong>Main Task</strong> trunk. Every tangential inquiry or sparked idea sprouts as an offshoot branch while keeping your root stem strictly anchored.
                </p>

                {/* Handcrafted Monochrome Botanical Tree SVG Example */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                    padding: '16px 12px 10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <svg width="520" height="150" viewBox="0 0 520 150" fill="none" style={{ maxWidth: '100%', height: 'auto' }}>
                    {/* Central Vertical Trunk (Main Task Stem) */}
                    <line x1="260" y1="135" x2="260" y2="28" stroke="#181818" strokeWidth="3" strokeLinecap="round" />

                    {/* Step Milestone Nodes on Trunk */}
                    {/* Root Node (Bottom) */}
                    <circle cx="260" cy="135" r="7" fill="#FFFFFF" stroke="#181818" strokeWidth="2.5" />
                    <text x="260" y="148" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#181818" fontFamily="inherit">Root: Main Work</text>

                    {/* Lower Step */}
                    <circle cx="260" cy="98" r="5" fill="#181818" />
                    <text x="248" y="102" textAnchor="end" fontSize="9" fontWeight="500" fill="#787774" fontFamily="inherit">Step 1: Outline</text>

                    {/* Upper Step */}
                    <circle cx="260" cy="62" r="5" fill="#181818" />
                    <text x="248" y="66" textAnchor="end" fontSize="9" fontWeight="500" fill="#787774" fontFamily="inherit">Step 2: Build</text>

                    {/* Active Growing Tip */}
                    <circle cx="260" cy="26" r="9" fill="rgba(24, 24, 24, 0.08)" stroke="#181818" strokeWidth="1.5" />
                    <circle cx="260" cy="26" r="4.5" fill="#181818" />
                    <text x="260" y="14" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#181818" fontFamily="inherit">Growing Tip (Current Focus)</text>

                    {/* Left Curiosity Thought Branch 1 (Sprouted from Step 1) */}
                    <path
                      d="M 260 98 C 210 98, 170 82, 120 78"
                      stroke="#787774"
                      strokeWidth="1.75"
                      strokeDasharray="3 3"
                      fill="none"
                    />
                    <circle cx="120" cy="78" r="4.5" fill="#FFFFFF" stroke="#787774" strokeWidth="1.75" />
                    <text x="120" y="94" textAnchor="middle" fontSize="8.5" fontWeight="500" fill="#787774" fontFamily="inherit">Thought: Check API docs</text>

                    {/* Sub-branch from Thought 1 */}
                    <path
                      d="M 120 78 C 90 78, 65 65, 45 60"
                      stroke="#A8A29E"
                      strokeWidth="1.25"
                      strokeDasharray="2 2"
                      fill="none"
                    />
                    <circle cx="45" cy="60" r="3.5" fill="#FFFFFF" stroke="#A8A29E" strokeWidth="1.5" />
                    <text x="45" y="50" textAnchor="middle" fontSize="8" fontWeight="450" fill="#A8A29E" fontFamily="inherit">Spur: OAuth spec</text>

                    {/* Right Curiosity Thought Branch 2 (Sprouted from Step 2) */}
                    <path
                      d="M 260 62 C 310 62, 350 48, 410 42"
                      stroke="#787774"
                      strokeWidth="1.75"
                      strokeDasharray="3 3"
                      fill="none"
                    />
                    <circle cx="410" cy="42" r="4.5" fill="#FFFFFF" stroke="#787774" strokeWidth="1.75" />
                    <text x="410" y="32" textAnchor="middle" fontSize="8.5" fontWeight="500" fill="#787774" fontFamily="inherit">Thought: UI inspiration?</text>

                    {/* Right Dropped / Abandoned Branch */}
                    <path
                      d="M 260 98 C 300 98, 340 108, 390 114"
                      stroke="#D6D3D1"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                      fill="none"
                    />
                    <circle cx="390" cy="114" r="4" fill="#FFFFFF" stroke="#D6D3D1" strokeWidth="1.5" />
                    <line x1="387" y1="111" x2="393" y2="117" stroke="#A8A29E" strokeWidth="1.2" />
                    <line x1="393" y1="111" x2="387" y2="117" stroke="#A8A29E" strokeWidth="1.2" />
                    <text x="390" y="128" textAnchor="middle" fontSize="8.5" fontWeight="450" fill="#A8A29E" fontFamily="inherit">Dropped Thought (Pruned)</text>
                  </svg>

                  <div style={{ fontSize: '10.5px', color: '#9B9A97', fontStyle: 'italic', letterSpacing: '0.01em' }}>
                    Trunk = Sequential main milestones • Lateral Dashed Lines = Curiosity thoughts • X = Pruned ideas
                  </div>
                </div>
              </div>

              {/* Core Philosophy Section 1: Attention Flow & Anti-Drift */}
              <div
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  padding: '13px 15px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, fontSize: '12.5px', color: '#181818' }}>
                  <ShieldCheck size={14} strokeWidth={2} style={{ color: '#181818' }} />
                  <span>The Anti-Drift Engine: Never Lose Your Main Task</span>
                </div>
                <p style={{ fontSize: '11.5px', color: '#57534E', marginTop: '6px', lineHeight: 1.6, margin: '6px 0 0 0' }}>
                  The primary goal of Wander is to <strong>track your active attention flow while working on a single main task</strong> so you never drift away into endless browser tabs. When an urgent question or tangential idea strikes, press <kbd style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(0, 0, 0, 0.05)', border: '1px solid rgba(0, 0, 0, 0.08)', fontFamily: 'inherit' }}>T</kbd> to branch an offshoot thought. Your idea is safely offloaded onto the tree without stealing your working focus.
                </p>
              </div>

              {/* Core Philosophy Section 2: Botanical Pruning & Guilt-Free Quitting */}
              <div
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  padding: '13px 15px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, fontSize: '12.5px', color: '#181818' }}>
                  <GitBranch size={14} strokeWidth={2} style={{ color: '#181818' }} />
                  <span>Visual Comparison & Guilt-Free Pruning</span>
                </div>
                <p style={{ fontSize: '11.5px', color: '#57534E', marginTop: '6px', lineHeight: 1.6, margin: '6px 0 0 0' }}>
                  Whenever you look back at Wander, seeing your thoughts laid out visually against your main objective immediately calms cognitive overload. By comparing tangential thoughts against the central goal, your brain realizes what doesn&apos;t matter. You can <strong>drop or prune branches with zero guilt</strong>, freeing mental bandwidth to sprint toward what actually counts.
                </p>
              </div>

              {/* Core Philosophy Section 3: Completion Lock & Fresh Sprouting */}
              <div
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  padding: '13px 15px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, fontSize: '12.5px', color: '#181818' }}>
                  <Lock size={13} strokeWidth={2} style={{ color: '#181818' }} />
                  <span>Completion Lock: The Power of Finished Work</span>
                </div>
                <p style={{ fontSize: '11.5px', color: '#57534E', marginTop: '6px', lineHeight: 1.6, margin: '6px 0 0 0' }}>
                  When you mark your <strong>Main Task as Done</strong>, the tree reaches its final synthesis. <strong>You are no longer allowed to add or modify branches on that tree</strong>. This deliberate botanical constraint creates an addictive sense of closure. Work is completed, sealed in time, and transformed into the cosmic Continuum. To embark on your next adventure, press <kbd style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(0, 0, 0, 0.05)', border: '1px solid rgba(0, 0, 0, 0.08)', fontFamily: 'inherit' }}>Ctrl+N</kbd> to plant a brand-new tree.
                </p>
              </div>

              {/* Core Components Summary Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    borderRadius: '10px',
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                    padding: '12px 14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '12px', color: '#181818' }}>
                    <Lightbulb size={13} strokeWidth={2} style={{ color: '#181818' }} />
                    <span>Thought (<kbd style={{ fontFamily: 'inherit', fontSize: '10px' }}>T</kbd>)</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#787774', marginTop: '4px', lineHeight: 1.5, margin: '4px 0 0 0' }}>
                    Lateral offshoots. Captures ideas, references, or queries in the present moment without interrupting your active focus.
                  </p>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    borderRadius: '10px',
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                    padding: '12px 14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '12px', color: '#181818' }}>
                    <CornerDownRight size={13} strokeWidth={2} style={{ color: '#181818' }} />
                    <span>Step (<kbd style={{ fontFamily: 'inherit', fontSize: '10px' }}>S</kbd>)</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#787774', marginTop: '4px', lineHeight: 1.5, margin: '4px 0 0 0' }}>
                    Vertical milestones. Drives the main trunk forward in time toward the finish line (e.g. <em>Outline &rarr; Draft &rarr; Ship</em>).
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '4px 0' }}>
              {/* Section 1: Display & Clock */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#787774', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', paddingLeft: '4px' }}>
                  Display & Clock
                </div>
                <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.02)', borderRadius: '10px', border: '1px solid rgba(0, 0, 0, 0.06)', padding: '2px 14px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.04)'
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
                      padding: '10px 0',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.04)'
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
                      padding: '10px 0'
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
                </div>
              </div>

              {/* Section 2: Window & Edge Dock */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#787774', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', paddingLeft: '4px' }}>
                  Window & Edge Dock
                </div>
                <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.02)', borderRadius: '10px', border: '1px solid rgba(0, 0, 0, 0.06)', padding: '2px 14px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.04)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 550, color: '#1A1A1A' }}>Float Dock Above Browsers</div>
                      <div style={{ fontSize: '11px', color: '#9B9A97' }}>Keep the edge dock strictly visible and topmost over Brave, Chrome, and full-screen windows</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.alwaysOnTop !== false}
                      onChange={(e) => handleUpdateSettings({ alwaysOnTop: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#1A1A1A', cursor: 'pointer' }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.04)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 550, color: '#1A1A1A' }}>Auto-Dock on Click Outside</div>
                      <div style={{ fontSize: '11px', color: '#9B9A97' }}>Collapse into curved side dock when clicking browsers or other apps</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoDock !== false}
                      onChange={(e) => handleUpdateSettings({ autoDock: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#1A1A1A', cursor: 'pointer' }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 550, color: '#1A1A1A' }}>Start Minimized to Dock</div>
                      <div style={{ fontSize: '11px', color: '#9B9A97' }}>Launch directly as the subtle right-edge dock notch on startup</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.startDocked === true}
                      onChange={(e) => handleUpdateSettings({ startDocked: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#1A1A1A', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Data & Local Backups */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#787774', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', paddingLeft: '4px' }}>
                  Data & Local Backups
                </div>
                <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.02)', borderRadius: '10px', border: '1px solid rgba(0, 0, 0, 0.06)', padding: '12px 14px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 550, color: '#1A1A1A' }}>Automated Local Snapshots</div>
                    <div style={{ fontSize: '11px', color: '#9B9A97', marginTop: '2px' }}>
                      Continuous backups protect your attention paths whenever nodes are added, edited, or modified.
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                    <button
                      onClick={async () => {
                        try {
                          const res = await api.data.createBackup();
                          showToast(`Backup created: ${res.filename || 'wander-backup'}`);
                        } catch (err: any) {
                          showToast(err.message || 'Failed to create backup');
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '7px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#181818',
                        color: '#F5E6D8',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
                        transition: 'opacity 120ms ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                      <Download size={13} strokeWidth={2.2} />
                      <span>Get Backup</span>
                    </button>

                    <button
                      onClick={async () => {
                        try {
                          await api.data.openBackupsFolder();
                        } catch {
                          showToast('Could not open backups folder');
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '7px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(0, 0, 0, 0.12)',
                        backgroundColor: '#FFFFFF',
                        color: '#1A1A1A',
                        fontSize: '11.5px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'background-color 120ms ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                    >
                      <FolderOpen size={13} strokeWidth={2} />
                      <span>Backups Folder</span>
                    </button>
                  </div>

                  {/* Google Drive Cloud Backup */}
                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(0, 0, 0, 0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Cloud size={14} strokeWidth={2} style={{ color: '#1A1A1A' }} />
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1A1A1A' }}>Google Drive Cloud Backup</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#9B9A97', marginTop: '2px' }}>
                          {gdriveStatus.isConnected
                            ? `Connected as ${gdriveStatus.email || 'Google Account'} • Sandboxed AppData folder`
                            : 'Sync automated private snapshots to your personal Google Drive AppData folder.'}
                        </div>
                      </div>

                      {gdriveStatus.isConnected && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(0, 0, 0, 0.05)',
                            color: '#181818',
                            border: '1px solid rgba(0, 0, 0, 0.12)'
                          }}
                        >
                          Connected
                        </span>
                      )}
                    </div>

                    {gdriveStatus.isConnected ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                          <div style={{ fontSize: '11px', color: '#787774' }}>
                            {gdriveStatus.lastSyncAt
                              ? `Last cloud sync: ${new Date(gdriveStatus.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : 'Ready to sync'}
                          </div>

                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              onClick={async () => {
                                setIsSyncingGdrive(true);
                                try {
                                  const res = await api.gdrive.sync();
                                  if (res.success) {
                                    showToast('Cloud backup synced to Google Drive');
                                    const updated = await api.gdrive.getStatus();
                                    setGdriveStatus(updated);
                                  } else {
                                    showToast(res.error || 'Cloud sync failed');
                                  }
                                } catch (err: any) {
                                  showToast(err.message || 'Sync error');
                                } finally {
                                  setIsSyncingGdrive(false);
                                }
                              }}
                              disabled={isSyncingGdrive || isRestoringCloud}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid rgba(0, 0, 0, 0.12)',
                                backgroundColor: '#FFFFFF',
                                color: '#1A1A1A',
                                fontSize: '11px',
                                fontWeight: 500,
                                cursor: isSyncingGdrive ? 'wait' : 'pointer'
                              }}
                            >
                              <RefreshCw size={11} className={isSyncingGdrive ? 'animate-spin' : ''} />
                              <span>{isSyncingGdrive ? 'Syncing...' : 'Sync Now'}</span>
                            </button>

                            <button
                              onClick={async () => {
                                setIsRestoringCloud(true);
                                try {
                                  const res = await api.gdrive.restoreLatest();
                                  if (res.success) {
                                    showToast(`Restored ${res.importedTrees} trees from Google Drive`);
                                    onRefreshContext?.();
                                    const updated = await api.history.list();
                                    setHistoryItems(updated);
                                  } else {
                                    showToast(res.error || 'Restore failed');
                                  }
                                } catch (err: any) {
                                  showToast(err.message || 'Restore error');
                                } finally {
                                  setIsRestoringCloud(false);
                                }
                              }}
                              disabled={isSyncingGdrive || isRestoringCloud}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid rgba(0, 0, 0, 0.16)',
                                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                color: '#181818',
                                fontSize: '11px',
                                fontWeight: 500,
                                cursor: isRestoringCloud ? 'wait' : 'pointer'
                              }}
                            >
                              <Download size={11} className={isRestoringCloud ? 'animate-spin' : ''} />
                              <span>{isRestoringCloud ? 'Restoring...' : 'Restore from Cloud'}</span>
                            </button>

                            <button
                              onClick={async () => {
                                try {
                                  await api.gdrive.disconnect();
                                  setGdriveStatus({ isConnected: false });
                                  setCloudRestorePrompt(null);
                                  showToast('Google Drive disconnected');
                                } catch {
                                  showToast('Failed to disconnect');
                                }
                              }}
                              disabled={isSyncingGdrive || isRestoringCloud}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid rgba(0, 0, 0, 0.12)',
                                backgroundColor: '#FFFFFF',
                                color: '#787774',
                                fontSize: '11px',
                                fontWeight: 500,
                                cursor: 'pointer'
                              }}
                            >
                              <span>Disconnect</span>
                            </button>
                          </div>
                        </div>

                        {cloudRestorePrompt && (
                          <div
                            style={{
                              marginTop: '10px',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(0, 0, 0, 0.03)',
                              border: '1px solid rgba(0, 0, 0, 0.08)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}
                          >
                            <div style={{ fontSize: '11.5px', color: '#181818', lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 600 }}>Cloud backup detected: </span>
                              {cloudRestorePrompt.backupName}
                              {cloudRestorePrompt.backupDate && (
                                <span style={{ color: '#787774', marginLeft: '4px' }}>
                                  ({new Date(cloudRestorePrompt.backupDate).toLocaleDateString()})
                                </span>
                              )}
                              . Restore and merge cloud trees with your current local work?
                            </div>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={async () => {
                                  setIsRestoringCloud(true);
                                  try {
                                    const res = await api.gdrive.restoreLatest(cloudRestorePrompt.backupId);
                                    if (res.success) {
                                      showToast(`Restored ${res.importedTrees} trees from Google Drive`);
                                      onRefreshContext?.();
                                      const updated = await api.history.list();
                                      setHistoryItems(updated);
                                    } else {
                                      showToast(res.error || 'Restore failed');
                                    }
                                  } catch (err: any) {
                                    showToast(err.message || 'Restore error');
                                  } finally {
                                    setIsRestoringCloud(false);
                                    setCloudRestorePrompt(null);
                                  }
                                }}
                                disabled={isRestoringCloud}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '5px',
                                  border: 'none',
                                  backgroundColor: '#181818',
                                  color: '#FFFFFF',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: isRestoringCloud ? 'wait' : 'pointer'
                                }}
                              >
                                {isRestoringCloud ? 'Restoring...' : 'Restore & Merge'}
                              </button>

                              <button
                                onClick={async () => {
                                  setCloudRestorePrompt(null);
                                  await api.gdrive.sync();
                                  showToast('Current workspace backed up to Google Drive');
                                  const updated = await api.gdrive.getStatus();
                                  setGdriveStatus(updated);
                                }}
                                disabled={isRestoringCloud}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '5px',
                                  border: '1px solid rgba(0, 0, 0, 0.12)',
                                  backgroundColor: '#FFFFFF',
                                  color: '#1A1A1A',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  cursor: 'pointer'
                                }}
                              >
                                Keep Local Only
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={async () => {
                          setIsConnectingGdrive(true);
                          try {
                            const res = await api.gdrive.connect();
                            if (res.success) {
                              setGdriveStatus({ isConnected: true, email: res.email });
                              showToast(`Connected to Google Drive (${res.email || 'Account'})`);

                              const latestBackup = await api.gdrive.checkBackups();
                              if (latestBackup) {
                                const currentHistory = await api.history.list();
                                if (!currentHistory || currentHistory.length === 0) {
                                  setIsRestoringCloud(true);
                                  try {
                                    const restoreRes = await api.gdrive.restoreLatest(latestBackup.id);
                                    if (restoreRes.success) {
                                      showToast(`Restored ${restoreRes.importedTrees} trees from Google Drive`);
                                      onRefreshContext?.();
                                      const updatedHistory = await api.history.list();
                                      setHistoryItems(updatedHistory);
                                    } else {
                                      showToast(restoreRes.error || 'Failed to restore cloud backup');
                                    }
                                  } finally {
                                    setIsRestoringCloud(false);
                                  }
                                } else {
                                  setCloudRestorePrompt({
                                    backupId: latestBackup.id,
                                    backupName: latestBackup.name,
                                    backupDate: latestBackup.createdTime
                                  });
                                }
                              } else {
                                await api.gdrive.sync();
                                const updated = await api.gdrive.getStatus();
                                setGdriveStatus(updated);
                              }
                            } else {
                              showToast(res.error || 'Google Drive connection canceled');
                            }
                          } catch (err: any) {
                            showToast(err.message || 'Connection failed');
                          } finally {
                            setIsConnectingGdrive(false);
                          }
                        }}
                        disabled={isConnectingGdrive}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '7px 12px',
                          marginTop: '6px',
                          borderRadius: '6px',
                          border: '1px solid rgba(0, 0, 0, 0.12)',
                          backgroundColor: '#FFFFFF',
                          color: '#1A1A1A',
                          fontSize: '11.5px',
                          fontWeight: 550,
                          cursor: isConnectingGdrive ? 'wait' : 'pointer',
                          transition: 'background-color 120ms ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                      >
                        <Cloud size={13} strokeWidth={2} />
                        <span>{isConnectingGdrive ? 'Opening browser to connect...' : 'Connect Google Drive'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 4: Application & Updates */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#787774', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', paddingLeft: '4px' }}>
                  Application & Updates
                </div>
                <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.02)', borderRadius: '10px', border: '1px solid rgba(0, 0, 0, 0.06)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 550, color: '#1A1A1A' }}>Wander</div>
                      <div style={{ fontSize: '11px', color: '#9B9A97' }}>
                        Version {currentAppVersion} {updateStatus && `• ${updateStatus}`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {updateInfo?.isNewer && downloadProgress.stage === 'idle' && (
                        <button
                          onClick={async () => {
                            setDownloadProgress({ stage: 'downloading', percent: 0, transferredMB: '0', totalMB: '0' });
                            try {
                              if (window.attentionApp?.updater?.startDownload) {
                                await api.updater.startDownload(updateInfo.downloadUrl);
                              } else {
                                await api.updater.install(updateInfo.downloadUrl || updateInfo.releaseUrl);
                              }
                            } catch (err: any) {
                              setDownloadProgress({
                                stage: 'error',
                                percent: 0,
                                transferredMB: '0',
                                totalMB: '0',
                                error: err.message || 'Download failed'
                              });
                            }
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#181818',
                            color: '#F5E6D8',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 5px rgba(0, 0, 0, 0.12)'
                          }}
                        >
                          <Download size={12} strokeWidth={2.2} />
                          <span>Download & Update</span>
                        </button>
                      )}

                      <button
                        onClick={async () => {
                          if (updateInfo?.isNewer && updateInfo?.downloadUrl) {
                            setUpdateStatus('Starting download...');
                            try {
                              await api.updater.startDownload(updateInfo.downloadUrl);
                            } catch (err: any) {
                              setUpdateStatus('Download failed');
                              setDownloadProgress({
                                stage: 'error',
                                percent: 0,
                                transferredMB: '0',
                                totalMB: '0',
                                error: err.message || 'Download failed'
                              });
                            }
                          } else {
                            setIsCheckingUpdate(true);
                            setUpdateStatus('Checking GitHub...');
                            try {
                              const res = await checkForAppUpdates();
                              setUpdateInfo(res);
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
                          }
                        }}
                        disabled={isCheckingUpdate || downloadProgress.stage === 'downloading'}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(0, 0, 0, 0.12)',
                          backgroundColor: updateInfo?.isNewer ? '#181818' : '#FFFFFF',
                          color: updateInfo?.isNewer ? '#F5E6D8' : '#1A1A1A',
                          fontSize: '11.5px',
                          fontWeight: updateInfo?.isNewer ? 600 : 500,
                          cursor: isCheckingUpdate ? 'wait' : 'pointer'
                        }}
                      >
                        {isCheckingUpdate ? 'Checking...' : updateInfo?.isNewer ? 'Update Now' : 'Check for Updates'}
                      </button>
                    </div>
                  </div>

                  {/* Progress bar inside Preferences dialog */}
                  {(downloadProgress.stage === 'downloading' || downloadProgress.stage === 'downloaded' || downloadProgress.stage === 'installing') && (
                    <div style={{ marginTop: '10px', padding: '8px 10px', backgroundColor: 'rgba(0, 0, 0, 0.03)', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#5C554F', marginBottom: '4px' }}>
                        <span>
                          {downloadProgress.stage === 'installing' || downloadProgress.stage === 'downloaded'
                            ? 'Installing update & restarting Wander...'
                            : `Downloading update... ${downloadProgress.transferredMB} MB / ${downloadProgress.totalMB} MB`}
                        </span>
                        <span style={{ fontWeight: 600 }}>{downloadProgress.percent}%</span>
                      </div>
                      <div style={{ width: '100%', height: '5px', backgroundColor: 'rgba(0, 0, 0, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${downloadProgress.stage === 'installing' || downloadProgress.stage === 'downloaded' ? 100 : downloadProgress.percent}%`,
                            height: '100%',
                            backgroundColor: '#C49B71',
                            borderRadius: '3px',
                            transition: 'width 150ms linear'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {downloadProgress.stage === 'error' && (
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#C04B37', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{downloadProgress.error || 'Download failed'}</span>
                      <button
                        onClick={() => window.open(updateInfo?.releaseUrl || 'https://github.com/guider23/Wander/releases', '_blank')}
                        style={{ background: 'none', border: 'none', color: '#A06A38', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
                      >
                        Open in Browser
                      </button>
                    </div>
                  )}
                </div>
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
          <span>Wander Spotlight</span>
        </div>
      </div>
    </div>
  );
};
