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
  let autoDockEnabled = true;  // Enable auto-dock by default

  const isMac = process.platform === 'darwin';
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
    alwaysOnTop: true,  // Keep window above all other apps
    autoHideMenuBar: true,
    title: 'Attention Path',
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
    win.center();
    normalBounds = win.getBounds();
    console.log('✓ Window bounds:', normalBounds);
    if (isMac && typeof win.setWindowButtonVisibility === 'function') {
      win.setWindowButtonVisibility(false);
    }
    console.log('✓ Calling win.show()');
    win.show();
    console.log('✓ Calling win.focus()');
    win.focus();
    console.log('✓ Window visible:', win.isVisible(), 'minimized:', win.isMinimized());
    
    // Force window to front
    win.setAlwaysOnTop(true);
    win.setAlwaysOnTop(false);

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
    
    // Only capture normalBounds if current window is in full normal mode
    const curBounds = win.getBounds();
    if (curBounds.width > 400 && curBounds.height > 400) {
      normalBounds = curBounds;
    }

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
      const targetY = Math.max(dY, Math.min(dY + dH - dockHeight, Math.round(dY + dH / 2 - dockHeight / 2)));

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
        win.setMovable(false);  // Lock dock position - prevent dragging
        win.setResizable(false);  // Prevent resizing
        win.setBackgroundColor('#00000000');  // Ensure transparent background
        win.setBounds({
          x: targetX,
          y: targetY,
          width: dockWidth,
          height: dockHeight
        });
        if (isMac && typeof win.setWindowButtonVisibility === 'function') {
          win.setWindowButtonVisibility(false);
        }
      }, 35);
    }, 200);
  }

  function expandWindow() {
    if (!win || win.isDestroyed()) return;
    isDocked = false;
    isDockingInProgress = false;
    win.setAlwaysOnTop(true);  // Keep on top even when expanded
    win.setMovable(true);  // Allow moving when expanded
    win.setResizable(true);  // Allow resizing when expanded

    const targetBounds = (normalBounds.width > 400 && normalBounds.height > 400)
      ? normalBounds
      : { width: 1150, height: 820, x: normalBounds.x || 100, y: normalBounds.y || 100 };
    win.setBounds(targetBounds);
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

  ipcMain.handle('attention:toggle-auto-dock', (_e, enabled: boolean) => {
    autoDockEnabled = enabled;
    return autoDockEnabled;
  });

  // Auto-dock when clicking outside the window (blur event)
  let blurTimeout: NodeJS.Timeout | null = null;
  win.on('blur', () => {
    console.log('Window blur event fired. autoDockEnabled:', autoDockEnabled, 'isDocked:', isDocked, 'isDockingInProgress:', isDockingInProgress);
    
    // Clear any existing timeout
    if (blurTimeout) clearTimeout(blurTimeout);
    
    // Use a small delay to ensure the blur is intentional (not just a brief focus change)
    blurTimeout = setTimeout(() => {
      if (autoDockEnabled && !isDocked && !isDockingInProgress) {
        console.log('Auto-docking to edge...');
        dockToEdge();
      }
    }, 100);
  });

  // Cancel auto-dock if window regains focus quickly
  win.on('focus', () => {
    if (blurTimeout) {
      clearTimeout(blurTimeout);
      blurTimeout = null;
    }
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
  if (isQuitting || process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  closeDatabase();
});
