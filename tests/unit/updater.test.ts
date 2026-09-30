import { describe, it, expect } from 'vitest';
import { isVersionGreater } from '../../src/utils/updater';
import { AutoUpdater } from '../../electron/updater/autoUpdater';

describe('Updater - Semver comparison', () => {
  it('correctly compares semantic versions with and without v prefix', () => {
    expect(isVersionGreater('v1.0.1', '1.0.0')).toBe(true);
    expect(isVersionGreater('1.1.0', '1.0.0')).toBe(true);
    expect(isVersionGreater('v2.0.0', 'v1.9.9')).toBe(true);
    expect(isVersionGreater('1.0.0', '1.0.0')).toBe(false);
    expect(isVersionGreater('v1.0.0', '1.0.0')).toBe(false);
    expect(isVersionGreater('1.0.0', '1.0.1')).toBe(false);
    expect(isVersionGreater('0.9.9', '1.0.0')).toBe(false);
  });
});

describe('Updater - Asset Matching', () => {
  const sampleAssets = [
    { name: 'Attention.Path.Setup.1.0.3.exe', browser_download_url: 'https://github.com/.../Setup.exe', size: 90000000 },
    { name: 'Attention.Path-1.0.3-arm64.dmg', browser_download_url: 'https://github.com/.../arm64.dmg', size: 95000000 },
    { name: 'Attention.Path-1.0.3-arm64-mac.zip', browser_download_url: 'https://github.com/.../arm64.zip', size: 93000000 },
    { name: 'Attention.Path-1.0.3-mac.zip', browser_download_url: 'https://github.com/.../mac.zip', size: 93000000 }
  ];

  it('selects the Windows NSIS Setup .exe on Windows', () => {
    const updater = new AutoUpdater();
    const origPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    const asset = updater.findBestAsset(sampleAssets);
    expect(asset).toBeDefined();
    expect(asset.name).toBe('Attention.Path.Setup.1.0.3.exe');

    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
  });

  it('selects the Apple Silicon DMG on macOS arm64', () => {
    const updater = new AutoUpdater();
    const origPlatform = process.platform;
    const origArch = process.arch;

    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    Object.defineProperty(process, 'arch', { value: 'arm64', configurable: true });

    const asset = updater.findBestAsset(sampleAssets);
    expect(asset).toBeDefined();
    expect(asset.name).toBe('Attention.Path-1.0.3-arm64.dmg');

    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    Object.defineProperty(process, 'arch', { value: origArch, configurable: true });
  });
});
