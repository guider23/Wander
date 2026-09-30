import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc/channels';
import { AppSettings } from '../src/domain/entities/types';

export const attentionAppApi = {
  sessions: {
    start: (title: string) => ipcRenderer.invoke(IPC_CHANNELS.START_WORK, { title }),
    pause: () => ipcRenderer.invoke(IPC_CHANNELS.PAUSE_SESSION),
    resume: (treeId: string, focusNodeId?: string) => ipcRenderer.invoke(IPC_CHANNELS.RESUME_SESSION, { treeId, focusNodeId }),
    switchFocus: (targetNodeId: string) => ipcRenderer.invoke(IPC_CHANNELS.SWITCH_FOCUS, { targetNodeId }),
    resumeContinuation: (originTreeId: string, originNodeId: string, rootTitle?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.RESUME_CONTINUATION, { originTreeId, originNodeId, rootTitle })
  },
  nodes: {
    captureThought: (title: string, parentNodeId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_THOUGHT, { title, parentNodeId }),
    addStep: (title: string, parentNodeId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.ADD_STEP, { title, parentNodeId }),
    createBranch: (title: string, parentNodeId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.CREATE_BRANCH, { title, parentNodeId }),
    complete: (nodeId: string, note?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.COMPLETE_PATH, { nodeId, note }),
    abandon: (nodeId: string, reason?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.ABANDON_PATH, { nodeId, reason }),
    abandonAllOpenBranches: () =>
      ipcRenderer.invoke(IPC_CHANNELS.ABANDON_ALL_OPEN_BRANCHES),
    rename: (nodeId: string, newTitle: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.RENAME_NODE, { nodeId, newTitle }),
    delete: (nodeId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.DELETE_NODE, { nodeId }),
    reactivate: (nodeId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.REACTIVATE_NODE, { nodeId }),
    restore: (nodeId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.RESTORE_NODE, { nodeId })
  },
  updater: {
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION),
    check: () => ipcRenderer.invoke(IPC_CHANNELS.CHECK_FOR_UPDATES),
    startDownload: (url?: string) => ipcRenderer.invoke(IPC_CHANNELS.START_UPDATE_DOWNLOAD, { url }),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_UPDATE_STATUS),
    install: (url?: string) => ipcRenderer.invoke(IPC_CHANNELS.INSTALL_UPDATE, { url }),
    onProgress: (callback: (status: any) => void) => {
      const listener = (_e: any, status: any) => callback(status);
      ipcRenderer.on('attention:update-progress', listener);
      return () => ipcRenderer.removeListener('attention:update-progress', listener);
    }
  },
  trees: {
    delete: (treeId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.DELETE_TREE, { treeId }),
    getActiveContext: () =>
      ipcRenderer.invoke(IPC_CHANNELS.GET_ACTIVE_CONTEXT),
    getTree: (treeId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GET_TREE, { treeId })
  },
  history: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.LIST_HISTORY)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
    save: (settings: Partial<AppSettings>) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings)
  },
  data: {
    export: () => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_DATA),
    import: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_DATA, data),
    deleteAll: () => ipcRenderer.invoke(IPC_CHANNELS.DELETE_ALL_DATA)
  },
  windowControls: {
    dock: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_DOCK),
    expand: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_EXPAND),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
    onDockChanged: (callback: (docked: boolean) => void) => {
      const listener = (_e: any, docked: boolean) => callback(docked);
      ipcRenderer.on('attention:dock-changed', listener);
      return () => ipcRenderer.removeListener('attention:dock-changed', listener);
    },
    onDockStart: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('attention:dock-start', listener);
      return () => ipcRenderer.removeListener('attention:dock-start', listener);
    }
  }
};

contextBridge.exposeInMainWorld('attentionApp', attentionAppApi);

export type AttentionAppApi = typeof attentionAppApi;
