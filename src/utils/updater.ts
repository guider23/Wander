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
  downloadUrl?: string;
  error?: string;
}

export const CURRENT_APP_VERSION = '1.0.0';
const DISMISSED_KEY = 'wander_dismissed_update_version';

/**
 * Compare two semver-like strings (e.g. "v1.0.1" and "1.0.0")
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

export function isUpdateDismissed(versionTag: string): boolean {
  try {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    return dismissed === versionTag;
  } catch {
    return false;
  }
}

export function dismissUpdate(versionTag: string): void {
  try {
    localStorage.setItem(DISMISSED_KEY, versionTag);
  } catch {
    // ignore
  }
}

export function clearDismissedUpdate(): void {
  try {
    localStorage.removeItem(DISMISSED_KEY);
  } catch {
    // ignore
  }
}

/**
 * Check GitHub repository for the latest release
 */
export async function checkForAppUpdates(): Promise<UpdateInfo> {
  const currentVersion = CURRENT_APP_VERSION;

  try {
    const response = await fetch('https://api.github.com/repos/guider23/Wander/releases/latest', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Attention-Path-Client'
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

    // Pick best asset for current platform
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    let matchedAsset = data.assets?.find((a: any) =>
      isMac ? a.name.endsWith('.dmg') || a.name.endsWith('.zip') : a.name.endsWith('.exe')
    );

    const downloadUrl = matchedAsset ? matchedAsset.browser_download_url : data.html_url;

    return {
      available: true,
      isNewer,
      currentVersion,
      latestVersion: latestTag,
      releaseName: data.name || latestTag,
      releaseNotes: data.body || '',
      publishedAt: data.published_at || '',
      releaseUrl: data.html_url || 'https://github.com/guider23/Wander/releases',
      downloadUrl
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
