import { ipcMain, shell } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from './channels';
import { ApplicationService } from '../application/service';

export function registerIpcHandlers(service: ApplicationService): void {
  ipcMain.handle(IPC_CHANNELS.START_WORK, async (_event, payload) => {
    const schema = z.object({ title: z.string().min(1) });
    const validated = schema.parse(payload);
    return service.startWork(validated.title);
  });

  ipcMain.handle(IPC_CHANNELS.CAPTURE_THOUGHT, async (_event, payload) => {
    const schema = z.object({
      title: z.string().min(1),
      parentNodeId: z.string().uuid()
    });
    const validated = schema.parse(payload);
    return service.captureThought(validated.title, validated.parentNodeId);
  });

  ipcMain.handle(IPC_CHANNELS.ADD_STEP, async (_event, payload) => {
    const schema = z.object({
      title: z.string().min(1),
      parentNodeId: z.string().uuid()
    });
    const validated = schema.parse(payload);
    return service.addStep(validated.title, validated.parentNodeId);
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_BRANCH, async (_event, payload) => {
    const schema = z.object({
      title: z.string().min(1),
      parentNodeId: z.string().uuid()
    });
    const validated = schema.parse(payload);
    return service.createBranch(validated.title, validated.parentNodeId);
  });

  ipcMain.handle(IPC_CHANNELS.SWITCH_FOCUS, async (_event, payload) => {
    const schema = z.object({ targetNodeId: z.string().uuid() });
    const validated = schema.parse(payload);
    return service.switchFocus(validated.targetNodeId);
  });

  ipcMain.handle(IPC_CHANNELS.PAUSE_SESSION, async () => {
    service.pauseActiveSession();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.RESUME_SESSION, async (_event, payload) => {
    const schema = z.object({
      treeId: z.string().uuid(),
      focusNodeId: z.string().uuid().optional()
    });
    const validated = schema.parse(payload);
    return service.resumeSession(validated.treeId, validated.focusNodeId);
  });

  ipcMain.handle(IPC_CHANNELS.RESUME_CONTINUATION, async (_event, payload) => {
    const schema = z.object({
      originTreeId: z.string().uuid(),
      originNodeId: z.string().uuid(),
      rootTitle: z.string().optional()
    });
    const validated = schema.parse(payload);
    return service.resumeContinuation(validated.originTreeId, validated.originNodeId, validated.rootTitle);
  });

  ipcMain.handle(IPC_CHANNELS.COMPLETE_PATH, async (_event, payload) => {
    const schema = z.object({
      nodeId: z.string().uuid(),
      note: z.string().optional()
    });
    const validated = schema.parse(payload);
    service.completePath(validated.nodeId, validated.note);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.ABANDON_PATH, async (_event, payload) => {
    const schema = z.object({
      nodeId: z.string().uuid(),
      reason: z.string().optional()
    });
    const validated = schema.parse(payload);
    service.abandonPath(validated.nodeId, validated.reason);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.ABANDON_ALL_OPEN_BRANCHES, async () => {
    return service.abandonAllOpenBranches();
  });

  ipcMain.handle(IPC_CHANNELS.RENAME_NODE, async (_event, payload) => {
    const schema = z.object({
      nodeId: z.string().uuid(),
      newTitle: z.string().min(1)
    });
    const validated = schema.parse(payload);
    service.renameNode(validated.nodeId, validated.newTitle);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_NODE, async (_event, payload) => {
    const schema = z.object({ nodeId: z.string().uuid() });
    const validated = schema.parse(payload);
    service.softDeleteNode(validated.nodeId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_TREE, async (_event, payload) => {
    const schema = z.object({ treeId: z.string().uuid() });
    const validated = schema.parse(payload);
    service.softDeleteTree(validated.treeId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.REACTIVATE_NODE, async (_event, payload) => {
    const schema = z.object({ nodeId: z.string().uuid() });
    const validated = schema.parse(payload);
    service.reactivateNode(validated.nodeId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.RESTORE_NODE, async (_event, payload) => {
    const schema = z.object({ nodeId: z.string().uuid() });
    const validated = schema.parse(payload);
    service.restoreNode(validated.nodeId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CHECK_FOR_UPDATES, async () => {
    try {
      const response = await fetch('https://api.github.com/repos/guider23/Wander/releases/latest', {
        headers: { 'User-Agent': 'Attention-Path-Desktop' }
      });
      if (!response.ok) return { available: false, error: `GitHub API status ${response.status}` };
      const data: any = await response.json();
      return {
        available: true,
        tagName: data.tag_name,
        name: data.name || data.tag_name,
        body: data.body || '',
        publishedAt: data.published_at,
        htmlUrl: data.html_url,
        assets: data.assets?.map((a: any) => ({
          name: a.name,
          browserDownloadUrl: a.browser_download_url,
          size: a.size
        })) || []
      };
    } catch (err: any) {
      return { available: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.INSTALL_UPDATE, async (_event, payload) => {
    const schema = z.object({ url: z.string().url() });
    const validated = schema.parse(payload);
    await shell.openExternal(validated.url);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.GET_ACTIVE_CONTEXT, async () => {
    return service.getActiveContext();
  });

  ipcMain.handle(IPC_CHANNELS.GET_TREE, async (_event, payload) => {
    const schema = z.object({ treeId: z.string().uuid() });
    const validated = schema.parse(payload);
    return service.getTree(validated.treeId);
  });

  ipcMain.handle(IPC_CHANNELS.LIST_HISTORY, async () => {
    return service.listHistory();
  });

  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    return service.settingsRepo.getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, async (_event, payload) => {
    return service.settingsRepo.saveSettings(payload);
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT_DATA, async () => {
    return service.exportData();
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_DATA, async (_event, payload) => {
    return service.importData(payload);
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_ALL_DATA, async () => {
    service.deleteAllData();
    return { success: true };
  });
}
