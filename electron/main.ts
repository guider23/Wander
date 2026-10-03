import { app, BrowserWindow, Menu, screen, ipcMain, Tray, nativeImage } from 'electron';
import path from 'path';
import { getDatabase, closeDatabase } from './db/connection';
import { ApplicationService } from './application/service';
import { registerIpcHandlers } from './ipc/handlers';
import { IPC_CHANNELS } from './ipc/channels';
import { AppSettings } from '../src/domain/entities/types';
import { DEFAULT_SETTINGS, SettingsRepository } from './db/repositories/settings-repository';

// Ensure only one instance of Wander runs at a time
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.log('Another instance of Wander is already running. Focusing primary instance.');
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;
let appTray: Tray | null = null;
let isQuitting = false;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

let autoDockEnabled = true;
let alwaysOnTopEnabled = true;
let isWindowDocked = false;
let isDockingInProgress = false;
let dockTopmostTimer: NodeJS.Timeout | null = null;
let currentSettingsRepo: SettingsRepository | null = null;

export function updateWindowSettings(settings: AppSettings): void {
  if (settings.autoDock !== undefined) {
    autoDockEnabled = settings.autoDock !== false;
  }
  if (settings.alwaysOnTop !== undefined) {
    alwaysOnTopEnabled = settings.alwaysOnTop !== false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (isWindowDocked) {
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        mainWindow.moveTop();
      } else {
        mainWindow.setAlwaysOnTop(alwaysOnTopEnabled, 'floating');
      }
    }
  }
}

function createWindow(settingsRepo?: SettingsRepository): BrowserWindow {
  Menu.setApplicationMenu(null);

  if (settingsRepo) {
    currentSettingsRepo = settingsRepo;
  }
  const initialSettings: AppSettings = currentSettingsRepo ? currentSettingsRepo.getSettings() : DEFAULT_SETTINGS;
  autoDockEnabled = initialSettings.autoDock !== false;
  alwaysOnTopEnabled = initialSettings.alwaysOnTop !== false;
  isWindowDocked = false;
  isDockingInProgress = false;

  const isMac = process.platform === 'darwin';
  const iconPath = path.join(__dirname, '../app-icon.png');

  // Pre-calculate centered normal bounds on primary display so normalBounds is never (0,0)
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: pX, y: pY, width: pW, height: pH } = primaryDisplay.workArea;
  let normalBounds = {
    width: 1150,
    height: 820,
    x: Math.round(pX + (pW - 1150) / 2),
    y: Math.round(pY + (pH - 820) / 2)
  };

  const win = new BrowserWindow({
    width: 1150,
    height: 820,
    minWidth: 44,
    minHeight: 180,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    show: false,
    alwaysOnTop: alwaysOnTopEnabled,
    autoHideMenuBar: true,
    title: 'Wander',
    icon: iconPath,
    skipTaskbar: !isMac,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Explicitly hide native macOS window control buttons (red/yellow/green traffic lights)
  if (isMac && typeof win.setWindowButtonVisibility === 'function') {
    win.setWindowButtonVisibility(false);
  }

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    console.log('Loading dev server URL:', devServerUrl);
    win.loadURL(devServerUrl);
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('Loading index path:', indexPath);
    win.loadFile(indexPath).catch((err) => {
      console.error('Failed to load index.html:', err);
    });
  }

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('Failed to load page:', code, desc);
  });

  win.webContents.on('did-finish-load', () => {
    console.log('✓ Page finished loading');
  });

  win.once('ready-to-show', () => {
    console.log('✓ ready-to-show event fired');

    if (initialSettings.startDocked) {
      // User preferred starting minimized directly as the edge dock
      isWindowDocked = true;
      const dockWidth = 60;
      const dockHeight = 250;
      const targetX = pX + pW - dockWidth;
      const targetY = Math.max(pY, Math.min(pY + pH - dockHeight, Math.round(pY + pH / 2 - dockHeight / 2)));
      win.setMovable(false);
      win.setResizable(false);
      win.setBounds({
        x: targetX,
        y: targetY,
        width: dockWidth,
        height: dockHeight
      });
      win.webContents.send('attention:dock-changed', true);
      win.setAlwaysOnTop(true, 'screen-saver', 1);
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      win.showInactive();
      win.moveTop();

      if (!dockTopmostTimer) {
        dockTopmostTimer = setInterval(() => {
          if (isWindowDocked && win && !win.isDestroyed()) {
            win.moveTop();
          }
        }, 1200);
      }
    } else {
      win.center();
      normalBounds = win.getBounds();
      if (isMac && typeof win.setWindowButtonVisibility === 'function') {
        win.setWindowButtonVisibility(false);
      }
      win.show();
      win.focus();

      // Maintain always on top if setting enabled (without dropping it)
      if (alwaysOnTopEnabled) {
        win.setAlwaysOnTop(true, 'floating');
      }
    }

    if (process.env.SCREENSHOT_MODE === '1') {
      autoDockEnabled = false;
      console.log('[SCREENSHOT_MODE] Window shown. Waiting 4000ms for full botanical tree render...');
      setTimeout(async () => {
        try {
          const image = await win.webContents.capturePage();
          const pngBuffer = image.toPNG();
          const fsModule = await import('fs');
          const p1 = path.join(__dirname, '../screenshot-tree.png');
          const p2 = 'C:\\Users\\sidhe\\OneDrive\\Desktop\\wander-opensource\\screenshot-tree.png';
          fsModule.writeFileSync(p1, pngBuffer);
          fsModule.writeFileSync(p2, pngBuffer);
          console.log('[SCREENSHOT_MODE] Saved capture successfully. Size:', pngBuffer.length, 'bytes');
        } catch (err) {
          console.error('[SCREENSHOT_MODE] Error capturing page:', err);
        } finally {
          isQuitting = true;
          app.quit();
          process.exit(0);
        }
      }, 4000);
    }
  });

  // Apple-inspired smooth minimize effect suctioning into the edge dock
  function dockToEdge() {
    if (isWindowDocked || isDockingInProgress || !win || win.isDestroyed()) return;
    isDockingInProgress = true;
    
    // Only capture normalBounds if current window is in full normal mode
    const curBounds = win.getBounds();
    if (curBounds.width > 400 && curBounds.height > 400) {
      normalBounds = curBounds;
    }

    // 1. Tell renderer to play the smooth Apple genie minimize animation
    win.webContents.send('attention:dock-start');

    // 2. Wait 200ms for the suction animation to glide into the dock notch position
    setTimeout(() => {
      if (!win || win.isDestroyed()) {
        isDockingInProgress = false;
        return;
      }
      // Determine target display: current window bounds or primary display
      const currentBounds = win.getBounds();
      const display = screen.getDisplayMatching(currentBounds) || screen.getPrimaryDisplay();
      const { x: dX, y: dY, width: dW, height: dH } = display.workArea;

      const dockWidth = 60;
      const dockHeight = 250;
      const targetX = dX + dW - dockWidth;
      const targetY = Math.max(dY, Math.min(dY + dH - dockHeight, Math.round(dY + dH / 2 - dockHeight / 2)));

      // Tell React to render transparent EdgeDockHandle FIRST before resizing OS window
      win.webContents.send('attention:dock-changed', true);

      setTimeout(() => {
        if (!win || win.isDestroyed()) {
          isDockingInProgress = false;
          return;
        }
        isWindowDocked = true;
        isDockingInProgress = false;

        win.setMovable(false);  // Lock dock position - prevent dragging
        win.setResizable(false);  // Prevent resizing
        win.setBackgroundColor('#00000000');  // Ensure transparent background

        // Set bounds FIRST
        win.setBounds({
          x: targetX,
          y: targetY,
          width: dockWidth,
          height: dockHeight
        });

        // Assert topmost priority AFTER setBounds so Windows SetWindowPos does NOT demote it
        win.setAlwaysOnTop(true, 'screen-saver', 1);
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        win.showInactive();
        win.moveTop();

        if (isMac && typeof win.setWindowButtonVisibility === 'function') {
          win.setWindowButtonVisibility(false);
        }

        // Maintain topmost presence above hardware-accelerated browsers like Brave, Chrome, Edge
        if (!dockTopmostTimer) {
          dockTopmostTimer = setInterval(() => {
            if (isWindowDocked && win && !win.isDestroyed()) {
              win.moveTop();
            }
          }, 1200);
        }
      }, 35);
    }, 200);
  }

  function expandWindow() {
    if (!win || win.isDestroyed()) return;
    isWindowDocked = false;
    isDockingInProgress = false;

    if (dockTopmostTimer) {
      clearInterval(dockTopmostTimer);
      dockTopmostTimer = null;
    }

    win.setMovable(true);  // Allow moving when expanded
    win.setResizable(true);  // Allow resizing when expanded

    const targetBounds = (normalBounds.width > 400 && normalBounds.height > 400)
      ? normalBounds
      : { width: 1150, height: 820, x: normalBounds.x || 100, y: normalBounds.y || 100 };
    win.setBounds(targetBounds);

    if (alwaysOnTopEnabled) {
      win.setAlwaysOnTop(true, 'floating');
    } else {
      win.setAlwaysOnTop(false);
    }

    if (isMac && typeof win.setWindowButtonVisibility === 'function') {
      win.setWindowButtonVisibility(false);
    }
    win.show();
    win.focus();
    win.webContents.send('attention:dock-changed', false);
  }

  // Intercept window close to keep running in background by docking to edge
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      dockToEdge();
    }
  });

  // Window control IPC handlers
  ipcMain.handle(IPC_CHANNELS.WINDOW_DOCK, () => {
    dockToEdge();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_EXPAND, () => {
    expandWindow();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
    isQuitting = true;
    win.close();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    win.minimize();
    return true;
  });

  // Auto-dock when clicking outside the window (blur event)
  let blurTimeout: NodeJS.Timeout | null = null;
  win.on('blur', () => {
    if (isWindowDocked) {
      // Re-assert topmost when blurred so clicking on Brave/Chrome never hides the side dock
      win.setAlwaysOnTop(true, 'screen-saver', 1);
      win.moveTop();
      return;
    }

    // Clear any existing timeout
    if (blurTimeout) clearTimeout(blurTimeout);
    
    // Use a small delay to ensure the blur is intentional (not just a brief focus change)
    blurTimeout = setTimeout(() => {
      if (autoDockEnabled && !isWindowDocked && !isDockingInProgress) {
        dockToEdge();
      }
    }, 120);
  });

  // Cancel auto-dock if window regains focus quickly
  win.on('focus', () => {
    if (blurTimeout) {
      clearTimeout(blurTimeout);
      blurTimeout = null;
    }
  });

  win.on('closed', () => {
    if (dockTopmostTimer) {
      clearInterval(dockTopmostTimer);
      dockTopmostTimer = null;
    }
    mainWindow = null;
  });

  // System Tray Setup
  setupSystemTray(win, { dockToEdge, expandWindow, isDocked: () => isWindowDocked });

  return win;
}

function setupSystemTray(
  win: BrowserWindow,
  actions: { dockToEdge: () => void; expandWindow: () => void; isDocked: () => boolean }
) {
  if (appTray) return;

  const isMac = process.platform === 'darwin';
  const iconPath = path.join(__dirname, '../app-icon.png');
  let trayImage: Electron.NativeImage;
  try {
    const rawImage = nativeImage.createFromPath(iconPath);
    // Use the exact same peach squircle icon on all platforms (Windows & macOS)
    const iconDimension = isMac ? 22 : 24;
    trayImage = rawImage.resize({ width: iconDimension, height: iconDimension, quality: 'best' });
  } catch (err) {
    console.error('Failed to load tray image:', err);
    trayImage = nativeImage.createFromPath(iconPath);
  }

  appTray = new Tray(trayImage);
  appTray.setToolTip('Wander — Human Attention Path');

  const refreshMenu = () => {
    const loginSettings = app.getLoginItemSettings();
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Wander (Running in Background)',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Open Canvas',
        click: () => {
          actions.expandWindow();
        }
      },
      {
        label: 'Dock to Screen Edge',
        click: () => {
          actions.dockToEdge();
        }
      },
      { type: 'separator' },
      {
        label: 'Start at System Login',
        type: 'checkbox',
        checked: app.isPackaged ? loginSettings.openAtLogin : false,
        enabled: app.isPackaged,
        click: (menuItem) => {
          if (app.isPackaged) {
            app.setLoginItemSettings({
              openAtLogin: menuItem.checked,
              path: process.execPath
            });
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit Wander',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);
    appTray?.setContextMenu(contextMenu);
  };

  refreshMenu();

  appTray.on('click', () => {
    if (actions.isDocked()) {
      actions.expandWindow();
    } else {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
}

app.whenReady().then(() => {
  // Set macOS dock icon to the exact same peach squircle pebble icon as Windows
  if (process.platform === 'darwin' && app.dock) {
    const dockIconPath = path.join(__dirname, '../app-icon.png');
    try {
      app.dock.setIcon(dockIconPath);
    } catch (e) {
      console.warn('Could not set macOS dock icon:', e);
    }
  }

  // Ensure auto-start when system starts (for packaged production app only)
  if (app.isPackaged) {
    try {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath
      });
    } catch (e) {
      console.warn('Could not register login item settings:', e);
    }
  } else {
    try {
      app.setLoginItemSettings({ openAtLogin: false });
    } catch (_) {}
  }

  const userDataPath = app.getPath('userData');
  const db = getDatabase(userDataPath);
  const appService = new ApplicationService(db, userDataPath);

  // Backup recovery check: restore data if original DB was missing or lost
  appService.restoreFromBackupIfDbMissing();

  // Crash recovery check: flag any unclosed sessions from previous crash
  appService.recoverInterruptedSessions();

  registerIpcHandlers(appService);

  mainWindow = createWindow(appService.settingsRepo);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow(appService.settingsRepo);
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (isQuitting || process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  closeDatabase();
});
