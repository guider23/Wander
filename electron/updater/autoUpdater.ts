import { app, BrowserWindow, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export interface AutoUpdateStatus {
  stage: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'installing' | 'error';
  currentVersion: string;
  latestVersion?: string;
  releaseName?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  assetName?: string;
  downloadUrl?: string;
  downloadPercent?: number;
  transferredBytes?: number;
  totalBytes?: number;
  error?: string;
}

export class AutoUpdater {
  private status: AutoUpdateStatus;
  private downloadedFilePath: string | null = null;
  private isDownloading: boolean = false;
  private activeAbortController: AbortController | null = null;

  private getAppVersion(): string {
    return typeof app?.getVersion === 'function' ? app.getVersion() : '1.0.3';
  }

  constructor() {
    this.status = {
      stage: 'idle',
      currentVersion: this.getAppVersion()
    };
  }

  public getStatus(): AutoUpdateStatus {
    return { ...this.status, currentVersion: this.getAppVersion() };
  }

  private notify(update: Partial<AutoUpdateStatus>): void {
    this.status = {
      ...this.status,
      ...update,
      currentVersion: this.getAppVersion()
    };

    const windows = typeof BrowserWindow?.getAllWindows === 'function' ? BrowserWindow.getAllWindows() : [];
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('attention:update-progress', this.status);
      }
    }
  }

  /**
   * Compare two semver-like strings (e.g. "v1.0.2" and "1.0.1")
   */
  public isVersionGreater(latest: string, current: string): boolean {
    const cleanLatest = latest.replace(/^v/i, '').trim();
    const cleanCurrent = current.replace(/^v/i, '').trim();

    if (cleanLatest === cleanCurrent) return false;

    const partsL = cleanLatest.split('.').map((p) => parseInt(p, 10) || 0);
    const partsC = cleanCurrent.split('.').map((p) => parseInt(p, 10) || 0);

    const len = Math.max(partsL.length, partsC.length);
    for (let i = 0; i < len; i++) {
      const l = partsL[i] || 0;
      const c = partsC[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  }

  /**
   * Pick best GitHub release asset for current platform and CPU architecture
   */
  public findBestAsset(assets: any[]): any {
    if (!assets || !assets.length) return null;

    const platform = process.platform;
    const arch = process.arch;

    if (platform === 'win32') {
      // Look for Windows NSIS Setup executable
      return (
        assets.find((a) => a.name.endsWith('.exe') && a.name.includes('Setup')) ||
        assets.find((a) => a.name.endsWith('.exe')) ||
        null
      );
    }

    if (platform === 'darwin') {
      if (arch === 'arm64') {
        // Apple Silicon (M1/M2/M3/M4)
        return (
          assets.find((a) => a.name.endsWith('.dmg') && a.name.includes('arm64')) ||
          assets.find((a) => a.name.endsWith('.dmg')) ||
          assets.find((a) => a.name.endsWith('.zip') && a.name.includes('arm64')) ||
          assets.find((a) => a.name.endsWith('.zip')) ||
          null
        );
      } else {
        // Intel x64
        return (
          assets.find((a) => a.name.endsWith('.dmg') && !a.name.includes('arm64')) ||
          assets.find((a) => a.name.endsWith('.dmg')) ||
          assets.find((a) => a.name.endsWith('.zip') && !a.name.includes('arm64')) ||
          assets.find((a) => a.name.endsWith('.zip')) ||
          null
        );
      }
    }

    return null;
  }

  /**
   * Check GitHub repository for latest release
   */
  public async checkForUpdates(): Promise<AutoUpdateStatus> {
    this.notify({ stage: 'checking', error: undefined });

    try {
      const response = await fetch('https://api.github.com/repos/guider23/Wander/releases/latest', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Attention-Path-AutoUpdater'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}`);
      }

      const data: any = await response.json();
      const latestTag = data.tag_name || '';
      const currentVersion = this.getAppVersion();
      const isNewer = this.isVersionGreater(latestTag, currentVersion);

      const matchedAsset = this.findBestAsset(data.assets || []);

      if (isNewer && matchedAsset) {
        this.notify({
          stage: 'available',
          latestVersion: latestTag,
          releaseName: data.name || latestTag,
          releaseNotes: data.body || '',
          releaseUrl: data.html_url || 'https://github.com/guider23/Wander/releases',
          assetName: matchedAsset.name,
          downloadUrl: matchedAsset.browser_download_url,
          totalBytes: matchedAsset.size || 0
        });
      } else {
        this.notify({
          stage: 'not-available',
          latestVersion: latestTag,
          releaseName: data.name || latestTag,
          releaseNotes: data.body || '',
          releaseUrl: data.html_url || 'https://github.com/guider23/Wander/releases'
        });
      }

      return this.getStatus();
    } catch (err: any) {
      this.notify({
        stage: 'error',
        error: err.message || 'Failed to check GitHub for updates'
      });
      return this.getStatus();
    }
  }

  /**
   * Download the update asset from GitHub directly with live progress
   */
  public async startDownload(customDownloadUrl?: string): Promise<string> {
    if (this.isDownloading) {
      if (this.downloadedFilePath && fs.existsSync(this.downloadedFilePath)) {
        return this.downloadedFilePath;
      }
      throw new Error('Update is already downloading.');
    }

    const downloadUrl = customDownloadUrl || this.status.downloadUrl;
    if (!downloadUrl) {
      throw new Error('No download URL available. Please check for updates first.');
    }

    this.isDownloading = true;
    this.activeAbortController = new AbortController();

    const updateDir = path.join(app.getPath('temp'), 'AttentionPathUpdate');
    if (!fs.existsSync(updateDir)) {
      fs.mkdirSync(updateDir, { recursive: true });
    }

    // Determine target filename
    const urlFilename = path.basename(new URL(downloadUrl).pathname);
    const filename = this.status.assetName || urlFilename || (process.platform === 'win32' ? 'AttentionPathSetup.exe' : 'AttentionPath.dmg');
    const targetPath = path.join(updateDir, filename);

    this.notify({
      stage: 'downloading',
      downloadPercent: 0,
      transferredBytes: 0,
      assetName: filename,
      downloadUrl
    });

    try {
      const response = await fetch(downloadUrl, {
        headers: {
          'User-Agent': 'Attention-Path-AutoUpdater'
        },
        redirect: 'follow',
        signal: this.activeAbortController.signal
      });

      if (!response.ok) {
        throw new Error(`Download request failed with status ${response.status}`);
      }

      const totalHeader = response.headers.get('content-length');
      const totalBytes = totalHeader ? parseInt(totalHeader, 10) : (this.status.totalBytes || 0);

      if (!response.body) {
        throw new Error('Empty response body received from download server.');
      }

      const fileStream = fs.createWriteStream(targetPath);
      const reader = response.body.getReader();
      let receivedBytes = 0;
      let lastReportTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          receivedBytes += value.length;
          fileStream.write(Buffer.from(value));

          // Throttle progress notifications to ~100ms
          const now = Date.now();
          if (now - lastReportTime >= 100 || receivedBytes === totalBytes) {
            lastReportTime = now;
            const percent = totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : 0;
            this.notify({
              stage: 'downloading',
              downloadPercent: percent,
              transferredBytes: receivedBytes,
              totalBytes
            });
          }
        }
      }

      await new Promise<void>((resolve, reject) => {
        fileStream.end((err?: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      this.downloadedFilePath = targetPath;
      this.isDownloading = false;

      this.notify({
        stage: 'downloaded',
        downloadPercent: 100,
        transferredBytes: receivedBytes,
        totalBytes: receivedBytes
      });

      return targetPath;
    } catch (err: any) {
      this.isDownloading = false;
      this.downloadedFilePath = null;
      try {
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      } catch (_) {}

      this.notify({
        stage: 'error',
        error: err.message || 'Download failed'
      });
      throw err;
    }
  }

  /**
   * Install the downloaded update and relaunch
   */
  public async installAndRestart(): Promise<void> {
    if (!this.downloadedFilePath || !fs.existsSync(this.downloadedFilePath)) {
      throw new Error('Downloaded update file not found. Please download again.');
    }

    const filePath = this.downloadedFilePath;
    const platform = process.platform;

    this.notify({ stage: 'installing' });

    if (platform === 'win32') {
      // Windows NSIS oneClick installer execution
      try {
        const installer = spawn(filePath, [], {
          detached: true,
          stdio: 'ignore'
        });
        installer.unref();

        // Give process a small moment before terminating Attention Path
        setTimeout(() => {
          app.quit();
          process.exit(0);
        }, 400);
      } catch (err: any) {
        this.notify({ stage: 'error', error: `Failed to execute Windows installer: ${err.message}` });
        throw err;
      }
      return;
    }

    if (platform === 'darwin') {
      // macOS installation (.dmg or .zip)
      if (filePath.endsWith('.dmg')) {
        const mountPoint = path.join(os.tmpdir(), `AttentionMount_${Date.now()}`);
        try {
          fs.mkdirSync(mountPoint, { recursive: true });

          // Attach DMG silently
          await execPromise(`hdiutil attach "${filePath}" -nobrowse -mountpoint "${mountPoint}" -quiet`);

          const appSource = path.join(mountPoint, 'Attention Path.app');
          const appDest = '/Applications/Attention Path.app';

          if (fs.existsSync(appSource)) {
            // Replace /Applications/Attention Path.app
            if (fs.existsSync(appDest)) {
              await execPromise(`rm -rf "${appDest}"`);
            }
            await execPromise(`cp -R "${appSource}" "/Applications/"`);

            // Clear quarantine attribute so Gatekeeper accepts it without warnings
            await execPromise(`xattr -cr "${appDest}"`).catch(() => {});

            // Detach DMG
            await execPromise(`hdiutil detach "${mountPoint}" -force -quiet`).catch(() => {});

            // Launch newly installed version
            spawn('open', ['-n', appDest], { detached: true, stdio: 'ignore' }).unref();

            setTimeout(() => {
              app.quit();
              process.exit(0);
            }, 400);
            return;
          } else {
            // Fallback: could not find .app in DMG mount, open DMG in Finder
            await execPromise(`hdiutil detach "${mountPoint}" -force -quiet`).catch(() => {});
            await shell.openPath(filePath);
            return;
          }
        } catch (err: any) {
          console.warn('macOS automated DMG update encountered error:', err);
          // Fallback: Open DMG in Finder for standard macOS install
          await shell.openPath(filePath);
          return;
        }
      } else if (filePath.endsWith('.zip')) {
        const extractDir = path.join(os.tmpdir(), `AttentionZip_${Date.now()}`);
        try {
          fs.mkdirSync(extractDir, { recursive: true });
          await execPromise(`ditto -xk "${filePath}" "${extractDir}"`);
          const appSource = path.join(extractDir, 'Attention Path.app');
          const appDest = '/Applications/Attention Path.app';

          if (fs.existsSync(appSource)) {
            if (fs.existsSync(appDest)) {
              await execPromise(`rm -rf "${appDest}"`);
            }
            await execPromise(`cp -R "${appSource}" "/Applications/"`);
            await execPromise(`xattr -cr "${appDest}"`).catch(() => {});
            spawn('open', ['-n', appDest], { detached: true, stdio: 'ignore' }).unref();

            setTimeout(() => {
              app.quit();
              process.exit(0);
            }, 400);
            return;
          }
        } catch (_) {
          await shell.openPath(filePath);
          return;
        }
      }
    }

    // Default fallback: open the file directly with default OS handler
    await shell.openPath(filePath);
  }
}

export const autoUpdater = new AutoUpdater();
