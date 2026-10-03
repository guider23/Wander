import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { OrganicAttentionTree } from './components/graph/OrganicAttentionTree';
import { MacDock } from './components/dock/MacDock';
import { EdgeDockHandle } from './components/dock/EdgeDockHandle';
import { NotionCommandModal, NotionInputKind } from './components/dialogs/NotionCommandModal';
import { SpotlightModal } from './components/dialogs/SpotlightModal';
import { ShortcutGuideModal } from './components/dialogs/ShortcutGuideModal';
import { WelcomeCloudModal } from './components/dialogs/WelcomeCloudModal';
import { UndoNotification, UndoAction } from './components/common/UndoNotification';
import { UpdateBanner } from './components/common/UpdateBanner';
import { checkForAppUpdates, isUpdateDismissed, UpdateInfo } from './utils/updater';
import { autocorrectSentence } from './domain/autocorrect/engine';
import { AppSettings } from './domain/entities/types';
import { api, ActiveContextDTO } from './api/client';
import { GalaxyCanvas } from './components/canvas/GalaxyCanvas';
import galaxyBg from './assets/galaxy-bg.jpg';

export const App: React.FC = () => {
  const [activeContext, setActiveContext] = useState<ActiveContextDTO>({
    activeTree: null,
    activeSession: null,
    activeNode: null,
    nodes: [],
    sessions: [],
    events: []
  });

  const [settings, setSettings] = useState<AppSettings>({
    timeFormat: '12h',
    reducedMotion: false,
    highContrast: false,
    continuumMode: 'auto',
    autoDock: true,
    alwaysOnTop: true,
    startDocked: false
  });

  // Dock to screen edge state & fluid Apple minimize animation state
  const [isDocked, setIsDocked] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [navigatedNodeId, setNavigatedNodeId] = useState<string | null>(null);
  const [expandTrigger, setExpandTrigger] = useState(0);  // Increment to trigger centering on expand

  // Modal & Dock state
  const [commandModalOpen, setCommandModalOpen] = useState(false);
  const [commandKind, setCommandKind] = useState<NotionInputKind>('work');
  const [contextNodeId, setContextNodeId] = useState<string | null>(null);
  const [contextNodeTitle, setContextNodeTitle] = useState<string | null>(null);

  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [spotlightTab, setSpotlightTab] = useState<'history' | 'model' | 'settings'>('history');

  const [guideOpen, setGuideOpen] = useState(false);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // Guards against the browser batching the initial paint at opacity:1 when the app
  // opens already in continuum/galaxy state. Stays false until two animation frames
  // have committed, ensuring the CSS transition always has a 0→1 journey to animate.
  const [isGalaxyAnimationReady, setIsGalaxyAnimationReady] = useState(false);
  useEffect(() => {
    let raf1: number;
    let raf2: number;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setIsGalaxyAnimationReady(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  // Pre-decode galaxy backdrop image and pre-warm WebGL shader pipeline during idle time.
  // This ensures shader compilation and texture upload happen in the background at launch,
  // completely eliminating the first-transition GPU shader compilation lag.
  const [isGalaxyWarmedUp, setIsGalaxyWarmedUp] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.src = galaxyBg;
    if ('decode' in img) {
      img.decode().catch(() => {});
    }

    const timer = setTimeout(() => {
      setIsGalaxyWarmedUp(true);
    }, 350);

    return () => clearTimeout(timer);
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await api.settings.get();
      if (s) setSettings(s);
    } catch (err: any) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  const refreshContext = useCallback(async () => {
    try {
      const ctx = await api.trees.getActiveContext();
      setActiveContext(ctx);
    } catch (err: any) {
      console.error('Failed to load active context:', err);
    }
  }, []);

  useEffect(() => {
    const initApp = async () => {
      await refreshSettings();
      try {
        const ctx = await api.trees.getActiveContext();
        setActiveContext(ctx);
        const history = await api.history.list();
        const hasAnyData = (ctx.nodes && ctx.nodes.length > 0) || (history && history.length > 0);
        const seen = localStorage.getItem('wander_welcome_seen');
        if (!hasAnyData && seen !== 'true') {
          setWelcomeModalOpen(true);
        }
      } catch (err: any) {
        console.error('Failed to initialize active context:', err);
      }
    };
    initApp();
  }, [refreshSettings]);

  // Active root node & status
  const activeRootNode = activeContext.nodes.find(
    (n) => n.id === activeContext.activeTree?.rootNodeId
  );
  const isParentTaskFinished = activeRootNode?.status === 'COMPLETED';
  const nodeCount = activeContext.nodes.length;
  const isMaxBranchesReached = nodeCount >= 3000;

  // Determine whether Continuum (Cosmic) Mode is active
  const isContinuumMode =
    settings.continuumMode === 'always'
      ? true
      : settings.continuumMode === 'never'
      ? false
      : (isParentTaskFinished || isMaxBranchesReached);

  // Track previous node count to trigger milestone notification when crossing 3000
  const prevCountRef = useRef(nodeCount);
  useEffect(() => {
    if (prevCountRef.current < 3000 && nodeCount >= 3000 && (!settings.continuumMode || settings.continuumMode === 'auto')) {
      if (!isParentTaskFinished) {
        showToast('3000-branch ceiling reached. Continuum engaged. Complete the main task to conclude this tree.', 8000);
      } else {
        showToast('Continuum engaged: 3000+ branches created.', 7000);
      }
    }
    prevCountRef.current = nodeCount;
  }, [nodeCount, settings.continuumMode, isParentTaskFinished]);

  // Sync data-density attribute on document root for smooth CSS variables cascade
  useEffect(() => {
    document.documentElement.setAttribute('data-density', isContinuumMode ? 'continuum' : 'standard');
  }, [isContinuumMode]);

  // Listen to Electron dock state changes with Apple fluid minimize coordination
  useEffect(() => {
    const unsubChanged = api.window.onDockChanged((docked) => {
      setIsDocked(docked);
      setIsCollapsing(false);
      // When expanding from dock, trigger node centering
      if (!docked) {
        setExpandTrigger(prev => prev + 1);
      }
    });
    const unsubStart = api.window.onDockStart(() => {
      setIsCollapsing(true);
    });
    return () => {
      unsubChanged();
      unsubStart();
    };
  }, []);

  // Check for app updates automatically on startup (non-blocking)
  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const info = await checkForAppUpdates();
        if (info.isNewer && !isUpdateDismissed(info.latestVersion)) {
          setUpdateInfo(info);
        }
      } catch {
        // Silently ignore if offline
      }
    };

    const timer = setTimeout(checkUpdates, 1000);
    return () => clearTimeout(timer);
  }, []);

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string, durationMs: number = 3600) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, durationMs);
  };

  const handleOpenCommand = (kind: NotionInputKind, targetNodeId?: string | null, targetTitle?: string | null) => {
    if (kind !== 'work') {
      if (isParentTaskFinished) {
        showToast('This work tree is completed. Press Ctrl+N to begin your next work path.', 6500);
        return;
      }
      if (isMaxBranchesReached) {
        showToast('You cannot create another branch in this tree because you have reached the maximum limit of 3000 branches. Please complete the main task before branching further.', 7500);
        return;
      }
    }
    setCommandKind(kind);
    const resolvedParentId =
      targetNodeId ||
      navigatedNodeId ||
      activeContext.activeNode?.id ||
      activeContext.activeTree?.rootNodeId ||
      null;
    const resolvedNode = activeContext.nodes.find((n) => n.id === resolvedParentId);
    setContextNodeId(resolvedParentId);
    setContextNodeTitle(targetTitle || resolvedNode?.title || activeContext.activeNode?.title || null);
    setCommandModalOpen(true);
  };

  const handleCommandSubmit = async (title: string, kind: NotionInputKind) => {
    try {
      const cleanTitle = autocorrectSentence(title).text;
      if (kind === 'work') {
        await api.sessions.start(cleanTitle);
        showToast('New work path started');
      } else if (kind === 'thought') {
        if (isParentTaskFinished) {
          showToast('This work tree is completed. Press Ctrl+N to begin your next work path.', 6500);
          setCommandModalOpen(false);
          return;
        }
        if (isMaxBranchesReached) {
          showToast('You cannot create another branch in this tree because you have reached the maximum limit of 3000 branches. Please complete the main task before branching further.', 7500);
          setCommandModalOpen(false);
          return;
        }
        const parentId = contextNodeId || activeContext.activeNode?.id || activeContext.activeTree?.rootNodeId;
        if (!parentId) throw new Error('No parent node selected');
        const node = await api.nodes.captureThought(cleanTitle, parentId);
        showToast('Thought captured');
        setUndoAction({
          id: uuidv4(),
          label: `Captured thought: "${cleanTitle}"`,
          onUndo: async () => {
            await api.nodes.delete(node.id);
            showToast(`Undid thought "${cleanTitle}"`);
            refreshContext();
          },
          timestamp: Date.now()
        });
      } else if (kind === 'step') {
        if (isParentTaskFinished) {
          showToast('This work tree is completed. Press Ctrl+N to begin your next work path.', 6500);
          setCommandModalOpen(false);
          return;
        }
        if (isMaxBranchesReached) {
          showToast('You cannot create another branch in this tree because you have reached the maximum limit of 3000 branches. Please complete the main task before branching further.', 7500);
          setCommandModalOpen(false);
          return;
        }
        const parentId = contextNodeId || activeContext.activeNode?.id || activeContext.activeTree?.rootNodeId;
        if (!parentId) throw new Error('No parent node selected');
        const res = await api.nodes.addStep(cleanTitle, parentId);
        showToast('Step recorded');
        setUndoAction({
          id: uuidv4(),
          label: `Added step: "${cleanTitle}"`,
          onUndo: async () => {
            await api.nodes.delete(res.node.id);
            showToast(`Undid step "${cleanTitle}"`);
            refreshContext();
          },
          timestamp: Date.now()
        });
      }
      setCommandModalOpen(false);
      refreshContext();
    } catch (err: any) {
      showToast(err.message || 'Operation failed');
    }
  };

  const handleSwitchFocus = async (nodeId: string) => {
    try {
      await api.sessions.switchFocus(nodeId);
      showToast('Focus moved');
      refreshContext();
    } catch (err: any) {
      showToast(err.message || 'Failed to switch focus');
    }
  };

  const handleComplete = async (nodeId: string) => {
    try {
      const isRootTask = nodeId === activeContext.activeTree?.rootNodeId;
      const wasAlreadyInGalaxy = isContinuumMode || isMaxBranchesReached || nodeCount >= 3000;
      const target = activeContext.nodes.find((n) => n.id === nodeId);
      await api.nodes.complete(nodeId);
      if (isRootTask) {
        if (wasAlreadyInGalaxy) {
          showToast('Main task concluded. Path finalized. Press Ctrl+N to begin your next work path.', 7500);
        } else {
          showToast('Main task concluded. Continuum engaged. Press Ctrl+N to begin your next work path.', 8000);
        }
      } else {
        showToast('Path marked completed');
      }
      setUndoAction({
        id: uuidv4(),
        label: `Marked completed: "${target?.title || 'Node'}"`,
        onUndo: async () => {
          await api.nodes.reactivate(nodeId);
          showToast(`Re-opened "${target?.title || 'Node'}"`);
          refreshContext();
        },
        timestamp: Date.now()
      });
      refreshContext();
    } catch (err: any) {
      showToast(err.message || 'Failed to complete path');
    }
  };

  const handleAbandon = async (nodeId: string) => {
    try {
      const target = activeContext.nodes.find((n) => n.id === nodeId);
      await api.nodes.abandon(nodeId);
      showToast('Path dropped / abandoned');
      setUndoAction({
        id: uuidv4(),
        label: `Dropped branch: "${target?.title || 'Node'}"`,
        onUndo: async () => {
          await api.nodes.reactivate(nodeId);
          showToast(`Restored branch "${target?.title || 'Node'}"`);
          refreshContext();
        },
        timestamp: Date.now()
      });
      refreshContext();
    } catch (err: any) {
      showToast(err.message || 'Failed to abandon path');
    }
  };

  const handleDeleteNode = async (nodeId: string, fallbackNodeId?: string) => {
    try {
      const target = activeContext.nodes.find((n) => n.id === nodeId);
      const hasChildren = activeContext.nodes.some(
        (n) => n.parentNodeId === nodeId && !n.deletedAt
      );
      if (hasChildren) {
        showToast('You cannot delete a node that has extended branches.', 6000);
        return;
      }
      await api.nodes.delete(nodeId, fallbackNodeId);
      showToast('Node deleted');
      setUndoAction({
        id: uuidv4(),
        label: `Deleted node: "${target?.title || 'Node'}"`,
        onUndo: async () => {
          await api.nodes.restore(nodeId);
          showToast(`Restored node "${target?.title || 'Node'}"`);
          refreshContext();
        },
        timestamp: Date.now()
      });
      refreshContext();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete node');
    }
  };

  const handleDropAllOpenBranches = async () => {
    try {
      const activeTreeId = activeContext.activeTree?.id;
      const rootId = activeContext.activeTree?.rootNodeId;
      const droppedIds = activeContext.nodes
        .filter((n) => n.treeId === activeTreeId && n.id !== rootId && n.status === 'ONGOING')
        .map((n) => n.id);

      const res = await api.nodes.abandonAllOpenBranches();
      if (res.count > 0) {
        showToast(`Dropped ${res.count} uncompleted branches`);
        setUndoAction({
          id: uuidv4(),
          label: `Dropped ${res.count} branches`,
          onUndo: async () => {
            for (const id of droppedIds) {
              await api.nodes.reactivate(id);
            }
            showToast(`Restored ${droppedIds.length} branches`);
            refreshContext();
          },
          timestamp: Date.now()
        });
      } else {
        showToast('No uncompleted branches to drop');
      }
      refreshContext();
    } catch (err: any) {
      showToast(err.message || 'Failed to drop branches');
    }
  };

  const handleResumeTree = async (treeId: string) => {
    try {
      await api.sessions.resume(treeId);
      showToast('Switched to tree');
      refreshContext();
    } catch (err: any) {
      showToast('Failed to switch tree');
    }
  };

  const handleDockToEdge = () => {
    setIsCollapsing(true);
    api.window.dock();
  };

  const handleExpandFromEdge = () => {
    setIsDocked(false);
    setIsCollapsing(false);
    api.window.expand();
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // Ctrl + Z / Cmd + Z: Undo last action
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        if (!isInput && undoAction) {
          e.preventDefault();
          const toUndo = undoAction;
          setUndoAction(null);
          toUndo.onUndo();
          return;
        }
      }

      // Ctrl + M: Toggle dock to edge
      if ((e.ctrlKey || e.metaKey) && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        if (isDocked) handleExpandFromEdge();
        else handleDockToEdge();
        return;
      }

      // Ctrl + Q: Quit/Close application
      if ((e.ctrlKey || e.metaKey) && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        api.window.close();
        return;
      }

      // Ctrl + Shift + D or Alt + D: Drop all uncompleted curiosity branches in one click
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'd' || e.key === 'D')) || (e.altKey && (e.key === 'd' || e.key === 'D'))) {
        e.preventDefault();
        handleDropAllOpenBranches();
        return;
      }

      // Ctrl + Shift + / or '?' opens Shortcuts Guide
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '?' || e.key === '/')) {
        e.preventDefault();
        setGuideOpen(true);
        return;
      }
      if (e.key === '?' && !isInput && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setGuideOpen(true);
        return;
      }

      // Ctrl + N: New Main Work
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        handleOpenCommand('work');
        return;
      }

      // Ctrl + H: History
      if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        setSpotlightTab('history');
        setSpotlightOpen(true);
        return;
      }

      // Ctrl + ,: Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setSpotlightTab('settings');
        setSpotlightOpen(true);
        return;
      }

      // Quick capture shortcuts when not typing in an input
      if (!isInput && !commandModalOpen && !spotlightOpen && !guideOpen && !isDocked) {
        if (e.key === 't' || e.key === 'T' || ((e.ctrlKey || e.metaKey) && (e.key === 't' || e.key === 'T'))) {
          if (activeContext.nodes.length > 0) {
            e.preventDefault();
            handleOpenCommand('thought');
          }
          return;
        }

        if (e.key === 's' || e.key === 'S' || ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S'))) {
          if (activeContext.nodes.length > 0) {
            e.preventDefault();
            handleOpenCommand('step');
          }
          return;
        }
      }

      // Esc to dismiss open dialogs
      if (e.key === 'Escape') {
        if (commandModalOpen) setCommandModalOpen(false);
        if (spotlightOpen) setSpotlightOpen(false);
        if (guideOpen) setGuideOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandModalOpen, spotlightOpen, guideOpen, activeContext, isDocked, navigatedNodeId, undoAction]);

  // If in collapsed Edge-Docked mode (protruding edge notch like reference image)
  if (isDocked) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: 'transparent',
          backgroundColor: 'transparent',
          overflow: 'hidden'
        }}
      >
        <EdgeDockHandle
          onExpand={handleExpandFromEdge}
          activeNode={activeContext.activeNode || activeRootNode}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--background-canvas)',
        backgroundColor: 'var(--background)',
        transition: isCollapsing
          ? 'appleGenieMinimize 220ms cubic-bezier(0.25, 1, 0.5, 1) forwards'
          : 'var(--theme-transition)',
        transformOrigin: 'right 50%',
        animation: isCollapsing
          ? 'appleGenieMinimize 220ms cubic-bezier(0.25, 1, 0.5, 1) forwards'
          : 'appleGenieExpand 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}
    >
      {/* Procedural WebGL Galaxy Backdrop (Smooth 2.2s cross-fade in Continuum Mode) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: (isContinuumMode && isGalaxyAnimationReady) ? 1 : 0,
          transition: 'opacity 2200ms cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
          zIndex: 0,
          overflow: 'hidden',
          willChange: 'opacity',
          transform: 'translateZ(0)'
        }}
      >
        {/* Subtle static image underlay for instant depth while WebGL initializes */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${galaxyBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.35,
            pointerEvents: 'none',
            transform: 'translateZ(0)'
          }}
        />
        <GalaxyCanvas
          active={isContinuumMode || isGalaxyWarmedUp}
          opacity={1}
        />
      </div>

      {/* Invisible Top Draggable Window Region (Zero Visible Buttons in UI) */}
      <div
        className="app-drag"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '32px',
          zIndex: 550,
          pointerEvents: 'auto'
        }}
      />

      {/* Subtle Vertical Brand Typography Watermark - Top Right Corner */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: '28px',
          right: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          userSelect: 'none',
          pointerEvents: 'none',
          zIndex: 40,
          color: 'transparent',
          WebkitTextStroke: 'var(--watermark-stroke, 0.8px rgba(165, 142, 122, 0.10))',
          transition: 'all 1600ms ease',
          fontFamily: 'inherit',
          fontSize: '42px',
          fontWeight: 900,
          letterSpacing: '0.04em',
          lineHeight: 0.95
        }}
      >
        <span>W</span>
        <span>A</span>
        <span>N</span>
        <span>D</span>
        <span>E</span>
        <span>R</span>
      </div>

      {/* 100% Organic Attention Tree Canvas */}
      <OrganicAttentionTree
        nodes={activeContext.nodes}
        activeNodeId={activeContext.activeNode?.id || null}
        onOpenCommand={(kind, id, title) => handleOpenCommand(kind, id, title)}
        onSwitchFocus={handleSwitchFocus}
        onComplete={handleComplete}
        onAbandon={handleAbandon}
        onDeleteNode={handleDeleteNode}
        onStartNewWork={() => handleOpenCommand('work')}
        onNavigatedNodeChange={setNavigatedNodeId}
        expandTrigger={expandTrigger}
        isContinuumMode={isContinuumMode && isGalaxyAnimationReady}
        isBranchLimitReached={isMaxBranchesReached}
        isParentTaskFinished={isParentTaskFinished}
        onShowToast={showToast}
      />

      {/* Galaxy Mode Status Pill (Clean, Non-Intrusive Guidance Floating Above Dock) */}
      {isContinuumMode && (
        <div
          style={{
            position: 'fixed',
            bottom: '86px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 14px',
            borderRadius: '20px',
            backgroundColor: 'rgba(3, 7, 18, 0.78)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(56, 189, 248, 0.28)',
            color: '#E0F2FE',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.01em',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
            pointerEvents: 'none',
            zIndex: 45
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isParentTaskFinished ? '#38BDF8' : '#F59E0B',
              boxShadow: isParentTaskFinished
                ? '0 0 8px #38BDF8'
                : '0 0 8px #F59E0B'
            }}
          />
          {isParentTaskFinished
            ? 'Main task completed. Press Ctrl+N to begin your next work path.'
            : isMaxBranchesReached
            ? 'Maximum branches reached (3000/3000). Complete main task to proceed.'
            : 'Continuum Mode Active'}
        </div>
      )}

      {/* Floating macOS-Style Dock at the Bottom */}
      <MacDock
        activeTitle={activeRootNode?.title}
        hasUpdate={!!updateInfo?.isNewer}
        isContinuumMode={isContinuumMode}
        onNewWork={() => handleOpenCommand('work')}
        onOpenHistory={() => {
          setSpotlightTab('history');
          setSpotlightOpen(true);
        }}
        onOpenMentalModel={() => {
          setSpotlightTab('model');
          setSpotlightOpen(true);
        }}
        onOpenSettings={() => {
          setSpotlightTab('settings');
          setSpotlightOpen(true);
        }}
        onOpenGuide={() => setGuideOpen(true)}
      />

      {/* Notion-Style Command Input Palette */}
      <NotionCommandModal
        isOpen={commandModalOpen}
        kind={commandKind}
        contextNodeTitle={contextNodeTitle}
        onSubmit={handleCommandSubmit}
        onCancel={() => setCommandModalOpen(false)}
      />

      {/* Ambient Spotlight Modal for History and Preferences */}
      <SpotlightModal
        isOpen={spotlightOpen}
        initialTab={spotlightTab}
        onClose={() => setSpotlightOpen(false)}
        onResumeTree={handleResumeTree}
        onRefreshContext={refreshContext}
        onSettingsChange={refreshSettings}
        showToast={showToast}
      />

      {/* Attention Path Guide & Shortcuts Modal */}
      <ShortcutGuideModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
      />

      {/* First-Launch Onboarding & Cross-System Cloud Restore Modal */}
      <WelcomeCloudModal
        isOpen={welcomeModalOpen}
        onStartFresh={() => {
          localStorage.setItem('wander_welcome_seen', 'true');
          setWelcomeModalOpen(false);
          handleOpenCommand('work');
        }}
        onRestored={() => {
          localStorage.setItem('wander_welcome_seen', 'true');
          setWelcomeModalOpen(false);
          refreshContext();
        }}
        onClose={() => {
          localStorage.setItem('wander_welcome_seen', 'true');
          setWelcomeModalOpen(false);
        }}
        showToast={showToast}
      />

      {/* Subtle Toast Notification */}
      {toastMessage && (
        <div
          onClick={() => {
            if (toastTimerRef.current) {
              clearTimeout(toastTimerRef.current);
              toastTimerRef.current = null;
            }
            setToastMessage(null);
          }}
          title="Click to dismiss"
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: isContinuumMode ? 'rgba(7, 12, 22, 0.94)' : 'rgba(24, 24, 24, 0.92)',
            color: isContinuumMode ? '#F0F9FF' : '#F5E6D8',
            border: isContinuumMode ? '1px solid rgba(56, 189, 248, 0.28)' : '1px solid rgba(255, 255, 255, 0.08)',
            padding: '7px 18px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 500,
            zIndex: 3000,
            boxShadow: isContinuumMode ? '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 16px rgba(56, 189, 248, 0.15)' : '0 4px 16px rgba(0, 0, 0, 0.15)',
            letterSpacing: '0.01em',
            backdropFilter: 'blur(12px)',
            cursor: 'pointer',
            maxWidth: '520px',
            textAlign: 'center',
            lineHeight: 1.45,
            animation: 'notionFadeIn 140ms ease-out'
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* 10s Minimal Auto-Hiding Undo Notification */}
      {undoAction && (
        <UndoNotification
          action={undoAction}
          onDismiss={() => setUndoAction(null)}
        />
      )}

      {/* Minimal App Update Banner */}
      {updateInfo && (
        <UpdateBanner
          update={updateInfo}
          onDismiss={() => setUpdateInfo(null)}
        />
      )}
    </div>
  );
};
