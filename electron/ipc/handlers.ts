import { app, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { IPC_CHANNELS } from './channels';
import { ApplicationService } from '../application/service';
import { autoUpdater } from '../updater/autoUpdater';
import { updateWindowSettings } from '../main';

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
    const schema = z.object({
      nodeId: z.string().uuid(),
      preferredFallbackNodeId: z.string().uuid().optional()
    });
    const validated = schema.parse(payload);
    service.softDeleteNode(validated.nodeId, validated.preferredFallbackNodeId);
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

  ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, async () => {
    return app.getVersion();
  });

  ipcMain.handle(IPC_CHANNELS.CHECK_FOR_UPDATES, async () => {
    return autoUpdater.checkForUpdates();
  });

  ipcMain.handle(IPC_CHANNELS.START_UPDATE_DOWNLOAD, async (_event, payload) => {
    const url = payload?.url;
    return autoUpdater.startDownload(url);
  });

  ipcMain.handle(IPC_CHANNELS.GET_UPDATE_STATUS, async () => {
    return autoUpdater.getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.INSTALL_UPDATE, async (_event, payload) => {
    try {
      await autoUpdater.installAndRestart();
      return { success: true };
    } catch (err: any) {
      if (payload?.url) {
        await shell.openExternal(payload.url);
        return { success: true, openedBrowser: true };
      }
      throw err;
    }
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
    const updated = service.settingsRepo.saveSettings(payload);
    updateWindowSettings(updated);
    return updated;
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

  ipcMain.handle(IPC_CHANNELS.CREATE_BACKUP, async () => {
    const result = service.createBackupSnapshot('manual');
    const targetFile = result.sqlitePath || result.jsonPath;
    if (targetFile && fs.existsSync(targetFile)) {
      shell.showItemInFolder(targetFile);
    }
    return {
      success: true,
      filename: result.filename,
      backupPath: targetFile
    };
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_BACKUPS_FOLDER, async () => {
    const backupsDir = path.join(service.userDataPath || path.join(process.cwd(), '.data'), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    await shell.openPath(backupsDir);
    return { success: true, backupsDir };
  });

  ipcMain.handle(IPC_CHANNELS.GDRIVE_CONNECT, async () => {
    return service.googleDrive.connect();
  });

  ipcMain.handle(IPC_CHANNELS.GDRIVE_DISCONNECT, async () => {
    return service.googleDrive.disconnect();
  });

  ipcMain.handle(IPC_CHANNELS.GDRIVE_STATUS, async () => {
    return service.googleDrive.getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.GDRIVE_SYNC, async () => {
    const backup = service.createBackupSnapshot('manual');
    const targetFile = backup.sqlitePath || backup.jsonPath;
    if (!targetFile) return { success: false, error: 'No backup file generated' };
    const uploadResult = await service.googleDrive.uploadBackupFile(targetFile);
    return {
      success: uploadResult.success,
      filename: uploadResult.filename,
      error: uploadResult.error
    };
  });

  ipcMain.handle(IPC_CHANNELS.GDRIVE_LIST, async () => {
    return service.googleDrive.listCloudBackups();
  });

  ipcMain.handle(IPC_CHANNELS.GDRIVE_RESTORE_LATEST, async (_event, fileId?: string) => {
    return service.restoreFromCloudBackup(fileId);
  });

  ipcMain.handle(IPC_CHANNELS.GDRIVE_CHECK_BACKUPS, async () => {
    return service.googleDrive.getLatestCloudBackup();
  });
}
