import { app, BrowserWindow, Menu, screen, ipcMain, Tray, nativeImage } from 'electron';
import path from 'path';
import { getDatabase, closeDatabase } from './db/connection';
import { ApplicationService } from './application/service';
import { registerIpcHandlers } from './ipc/handlers';
import { IPC_CHANNELS } from './ipc/channels';

// Ensure only one instance of Attention Path runs at a time
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.log('Another instance of Attention Path is already running. Focusing primary instance.');
  app.quit();
  process.exit(0);
}

// Prevent Windows file-lock contention on GPU shader disk cache
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

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

function createWindow(): BrowserWindow {
  Menu.setApplicationMenu(null);

  let isDocked = false;
  let isDockingInProgress = false;
  let normalBounds = { width: 1150, height: 820, x: 0, y: 0 };
  let autoDockEnabled = true;

  const iconPath = path.join(__dirname, '../app-icon.png');

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
    autoHideMenuBar: true,
    title: 'Attention Path',
    icon: iconPath,
    skipTaskbar: true, // Run seamlessly in background, not cluttering the taskbar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

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

  win.once('ready-to-show', () => {
    win.center();
    normalBounds = win.getBounds();
    win.show();
    win.focus();

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
    if (isDocked || isDockingInProgress || !win || win.isDestroyed()) return;
    isDockingInProgress = true;
    normalBounds = win.getBounds();

    // 1. Tell renderer to play the smooth Apple genie minimize animation
    win.webContents.send('attention:dock-start');

    // 2. Wait 220ms for the suction animation to glide into the dock notch position
    setTimeout(() => {
      if (!win || win.isDestroyed()) {
        isDockingInProgress = false;
        return;
      }
      const display = screen.getDisplayMatching(normalBounds);
      const { x: dX, y: dY, width: dW, height: dH } = display.workArea;

      const dockWidth = 60;
      const dockHeight = 250;
      const targetX = dX + dW - dockWidth;
      const targetY = Math.round(dY + dH / 2 - dockHeight / 2);

      // Tell React to render transparent EdgeDockHandle FIRST before resizing OS window
      win.webContents.send('attention:dock-changed', true);

      setTimeout(() => {
        if (!win || win.isDestroyed()) {
          isDockingInProgress = false;
          return;
        }
        isDocked = true;
        isDockingInProgress = false;
        win.setAlwaysOnTop(true, 'floating');
        win.setBounds({
          x: targetX,
          y: targetY,
          width: dockWidth,
          height: dockHeight
        });
      }, 35);
    }, 200);
  }

  function expandWindow() {
    if (!win || win.isDestroyed()) return;
    isDocked = false;
    isDockingInProgress = false;
    win.setAlwaysOnTop(false);
    win.setBounds(normalBounds);
    win.focus();
    win.webContents.send('attention:dock-changed', false);
  }

  // Smooth auto-dock to screen edge when user clicks outside the app
  let blurTimer: NodeJS.Timeout | null = null;
  win.on('blur', () => {
    if (process.env.SCREENSHOT_MODE === '1' || !autoDockEnabled || isDocked || isDockingInProgress) return;
    blurTimer = setTimeout(() => {
      if (!win.isDestroyed() && !win.isFocused() && !isDocked && !isDockingInProgress) {
        dockToEdge();
      }
    }, 220);
  });

  win.on('focus', () => {
    if (blurTimer) {
      clearTimeout(blurTimer);
      blurTimer = null;
    }
  });

  // Intercept window close to keep running in background tray unless quitting
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
    dockToEdge();
    return true;
  });

  ipcMain.handle('attention:toggle-auto-dock', (_e, enabled: boolean) => {
    autoDockEnabled = enabled;
    return autoDockEnabled;
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  // System Tray Setup
  setupSystemTray(win, { dockToEdge, expandWindow, isDocked: () => isDocked });

  return win;
}

function setupSystemTray(
  win: BrowserWindow,
  actions: { dockToEdge: () => void; expandWindow: () => void; isDocked: () => boolean }
) {
  if (appTray) return;

  const iconPath = path.join(__dirname, '../app-icon.png');
  let trayImage: Electron.NativeImage;
  try {
    const rawImage = nativeImage.createFromPath(iconPath);
    trayImage = rawImage.resize({ width: 24, height: 24, quality: 'best' });
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
        label: 'Attention Path (Running in Background)',
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
        checked: loginSettings.openAtLogin,
        click: (menuItem) => {
          app.setLoginItemSettings({
            openAtLogin: menuItem.checked,
            path: process.execPath
          });
        }
      },
      { type: 'separator' },
      {
        label: 'Quit Attention Path',
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
    } else if (!win.isVisible() || win.isMinimized()) {
      win.show();
      win.focus();
    } else {
      dockToEdgeAction();
    }
  });

  function dockToEdgeAction() {
    actions.dockToEdge();
  }
}

app.whenReady().then(() => {
  // Ensure auto-start when system starts
  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath
    });
  } catch (e) {
    console.warn('Could not register login item settings:', e);
  }

  const userDataPath = app.getPath('userData');
  const db = getDatabase(userDataPath);
  const appService = new ApplicationService(db);

  // Crash recovery check: flag any unclosed sessions from previous crash
  appService.recoverInterruptedSessions();

  registerIpcHandlers(appService);

  mainWindow = createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (isQuitting || process.platform === 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  closeDatabase();
});
