import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { OrganicAttentionTree } from './components/graph/OrganicAttentionTree';
import { MacDock } from './components/dock/MacDock';
import { EdgeDockHandle } from './components/dock/EdgeDockHandle';
import { NotionCommandModal, NotionInputKind } from './components/dialogs/NotionCommandModal';
import { SpotlightModal } from './components/dialogs/SpotlightModal';
import { ShortcutGuideModal } from './components/dialogs/ShortcutGuideModal';
import { UndoNotification, UndoAction } from './components/common/UndoNotification';
import { UpdateBanner } from './components/common/UpdateBanner';
import { checkForAppUpdates, isUpdateDismissed, UpdateInfo } from './utils/updater';
import { autocorrectSentence } from './domain/autocorrect/engine';
import { api, ActiveContextDTO } from './api/client';

export const App: React.FC = () => {
  const [activeContext, setActiveContext] = useState<ActiveContextDTO>({
    activeTree: null,
    activeSession: null,
    activeNode: null,
    nodes: [],
    sessions: [],
    events: []
  });

  // Dock to screen edge state & fluid Apple minimize animation state
  const [isDocked, setIsDocked] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [navigatedNodeId, setNavigatedNodeId] = useState<string | null>(null);

  // Modal & Dock state
  const [commandModalOpen, setCommandModalOpen] = useState(false);
  const [commandKind, setCommandKind] = useState<NotionInputKind>('work');
  const [contextNodeId, setContextNodeId] = useState<string | null>(null);
  const [contextNodeTitle, setContextNodeTitle] = useState<string | null>(null);

  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [spotlightTab, setSpotlightTab] = useState<'history' | 'settings'>('history');

  const [guideOpen, setGuideOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  const refreshContext = useCallback(async () => {
    try {
      const ctx = await api.trees.getActiveContext();
      setActiveContext(ctx);
    } catch (err: any) {
      console.error('Failed to load active context:', err);
    }
  }, []);

  useEffect(() => {
    refreshContext();
  }, [refreshContext]);

  // Listen to Electron dock state changes with Apple fluid minimize coordination
  useEffect(() => {
    const unsubChanged = api.window.onDockChanged((docked) => {
      setIsDocked(docked);
      setIsCollapsing(false);
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
    const timer = setTimeout(async () => {
      try {
        const info = await checkForAppUpdates();
        if (info.isNewer && !isUpdateDismissed(info.latestVersion)) {
          setUpdateInfo(info);
        }
      } catch {
        // Silently ignore if offline
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2400);
  };

  const handleOpenCommand = (kind: NotionInputKind, targetNodeId?: string | null, targetTitle?: string | null) => {
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
      const target = activeContext.nodes.find((n) => n.id === nodeId);
      await api.nodes.complete(nodeId);
      showToast('Path marked completed');
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

  const handleDeleteNode = async (nodeId: string) => {
    try {
      const target = activeContext.nodes.find((n) => n.id === nodeId);
      await api.nodes.delete(nodeId);
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

  const activeRootNode = activeContext.nodes.find(
    (n) => n.id === activeContext.activeTree?.rootNodeId
  );

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
        backgroundColor: '#F5E6D8',
        transformOrigin: 'right 50%',
        animation: isCollapsing
          ? 'appleGenieMinimize 220ms cubic-bezier(0.25, 1, 0.5, 1) forwards'
          : 'appleGenieExpand 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}
    >
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
          WebkitTextStroke: '0.8px rgba(165, 142, 122, 0.10)',
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
      />

      {/* Floating macOS-Style Dock at the Bottom */}
      <MacDock
        activeTitle={activeRootNode?.title}
        onNewWork={() => handleOpenCommand('work')}
        onOpenHistory={() => {
          setSpotlightTab('history');
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
        showToast={showToast}
      />

      {/* Attention Path Guide & Shortcuts Modal */}
      <ShortcutGuideModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
      />

      {/* Subtle Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(24, 24, 24, 0.92)',
            color: '#F5E6D8',
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 500,
            zIndex: 3000,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
            letterSpacing: '0.01em',
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
