import { api } from '../api/client';

export interface ReleaseAsset {
  name: string;
  browserDownloadUrl: string;
  size: number;
}

export interface UpdateInfo {
  available: boolean;
  isNewer: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  releaseUrl: string;
  assetName?: string;
  downloadUrl?: string;
  totalBytes?: number;
  error?: string;
}

export const FALLBACK_APP_VERSION = '1.0.4';
const DISMISSED_SESSION_KEY = 'wander_dismissed_update_version';

// Clear legacy permanent localStorage dismissal so users always get fresh checks on new app launch
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(DISMISSED_SESSION_KEY);
  }
} catch {}

/**
 * Compare two semver-like strings (e.g. "v1.0.3" and "1.0.2")
 */
export function isVersionGreater(latest: string, current: string): boolean {
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
 * Check if update has been dismissed during THIS application run/session.
 * When the user quits and re-opens Wander, sessionStorage is fresh, ensuring
 * updates are checked again on every launch.
 */
export function isUpdateDismissed(versionTag: string): boolean {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const dismissed = sessionStorage.getItem(DISMISSED_SESSION_KEY);
      return dismissed === versionTag;
    }
    return false;
  } catch {
    return false;
  }
}

export function dismissUpdate(versionTag: string): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(DISMISSED_SESSION_KEY, versionTag);
    }
  } catch {
    // ignore
  }
}

export function clearDismissedUpdate(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(DISMISSED_SESSION_KEY);
    }
  } catch {
    // ignore
  }
}

export async function getCurrentAppVersion(): Promise<string> {
  try {
    return await api.updater.getVersion();
  } catch {
    return FALLBACK_APP_VERSION;
  }
}

/**
 * Check GitHub repository for the latest release with platform-aware asset resolution
 */
export async function checkForAppUpdates(): Promise<UpdateInfo> {
  const currentVersion = await getCurrentAppVersion();

  try {
    // If running in Electron, use the main-process autoUpdater
    if (window.attentionApp?.updater?.check) {
      const status: any = await window.attentionApp.updater.check();
      const latestTag = status.latestVersion || '';
      const isNewer = isVersionGreater(latestTag, currentVersion);

      return {
        available: status.stage !== 'error' && !!latestTag,
        isNewer,
        currentVersion,
        latestVersion: latestTag,
        releaseName: status.releaseName || latestTag,
        releaseNotes: status.releaseNotes || '',
        publishedAt: status.publishedAt || '',
        releaseUrl: status.releaseUrl || 'https://github.com/guider23/Wander/releases',
        assetName: status.assetName,
        downloadUrl: status.downloadUrl,
        totalBytes: status.totalBytes,
        error: status.error
      };
    }

    // Web preview fallback
    const response = await fetch('https://api.github.com/repos/guider23/Wander/releases/latest', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Wander-Client'
      }
    });

    if (!response.ok) {
      return {
        available: false,
        isNewer: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseName: '',
        releaseNotes: '',
        publishedAt: '',
        releaseUrl: 'https://github.com/guider23/Wander/releases',
        error: `GitHub status ${response.status}`
      };
    }

    const data: any = await response.json();
    const latestTag = data.tag_name || '';
    const isNewer = isVersionGreater(latestTag, currentVersion);

    // Pick best asset for current browser platform
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    let matchedAsset = data.assets?.find((a: any) =>
      isMac ? a.name.endsWith('.dmg') || a.name.endsWith('.zip') : a.name.endsWith('.exe')
    );

    return {
      available: true,
      isNewer,
      currentVersion,
      latestVersion: latestTag,
      releaseName: data.name || latestTag,
      releaseNotes: data.body || '',
      publishedAt: data.published_at || '',
      releaseUrl: data.html_url || 'https://github.com/guider23/Wander/releases',
      assetName: matchedAsset?.name,
      downloadUrl: matchedAsset ? matchedAsset.browser_download_url : data.html_url,
      totalBytes: matchedAsset?.size
    };
  } catch (err: any) {
    return {
      available: false,
      isNewer: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseName: '',
      releaseNotes: '',
      publishedAt: '',
      releaseUrl: 'https://github.com/guider23/Wander/releases',
      error: err.message || 'Network error checking for updates'
    };
  }
}
