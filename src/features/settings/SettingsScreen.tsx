import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { AppSettings } from '../../domain/entities/types';
import { useUiStore } from '../../state/ui-store';

export const SettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    timeFormat: '12h',
    reducedMotion: false,
    highContrast: false
  });
  const [loading, setLoading] = useState(true);
  const { showToast } = useUiStore();
  const [gdriveStatus, setGdriveStatus] = useState<{ isConnected: boolean; email?: string; lastSyncAt?: string }>({ isConnected: false });
  const [isConnectingGdrive, setIsConnectingGdrive] = useState(false);
  const [isSyncingGdrive, setIsSyncingGdrive] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const s = await api.settings.get();
        setSettings(s);
        applySettingsToDom(s);
        api.gdrive.getStatus().then(setGdriveStatus).catch(() => {});
      } catch (err: any) {
        showToast('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const applySettingsToDom = (s: AppSettings) => {
    document.documentElement.setAttribute('data-reduced-motion', String(s.reducedMotion));
    document.documentElement.setAttribute('data-high-contrast', String(s.highContrast));
  };

  const handleUpdate = async (patch: Partial<AppSettings>) => {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    applySettingsToDom(updated);
    try {
      await api.settings.save(patch);
      showToast('Settings saved');
    } catch (err: any) {
      showToast('Failed to save settings');
    }
    showToast('Preferences updated');
  };

  const handleDeleteAll = async () => {
    if (!confirm('CAUTION: This will delete all history, trees, and sessions permanently. Continue?')) {
      return;
    }
    try {
      await api.data.deleteAll();
      showToast('All data deleted');
    } catch (err: any) {
      showToast('Failed to delete data');
    }
  };

  if (loading) {
    return <div style={{ padding: '24px' }}>Loading settings...</div>;
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: '680px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)' }}>Settings</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)', marginTop: '2px' }}>
          Preferences, accessibility, and local data
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Appearance & Accessibility */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--ink)' }}>Preferences</h3>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--ink-border)' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Time Format</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Choose 12-hour or 24-hour clock display</div>
            </div>
            <select
              value={settings.timeFormat}
              onChange={(e) => handleUpdate({ timeFormat: e.target.value as '12h' | '24h' })}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius)',
                border: '1.5px solid var(--ink)',
                backgroundColor: 'var(--background)',
                color: 'var(--ink)'
              }}
            >
              <option value="12h">12-hour</option>
              <option value="24h">24-hour</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--ink-border)' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Reduced Motion</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Disable animations when branches and nodes appear</div>
            </div>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => handleUpdate({ reducedMotion: e.target.checked })}
              style={{ width: '18px', height: '18px', accentColor: 'var(--ink)' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--ink-border)' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>High Contrast</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Increase contrast for maximum clarity</div>
            </div>
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={(e) => handleUpdate({ highContrast: e.target.checked })}
              style={{ width: '18px', height: '18px', accentColor: 'var(--ink)' }}
            />
          </div>
        </section>

        {/* Data Management */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--ink)' }}>Data & Privacy</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
            All attention data is stored locally in your SQLite database. No background internet telemetry is collected.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
            <button
              onClick={async () => {
                try {
                  const res = await api.data.createBackup();
                  showToast(`Backup created: ${res.filename || 'wander-backup'}`);
                } catch (err: any) {
                  showToast(err.message || 'Failed to create backup');
                }
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius)',
                border: '1.5px solid var(--ink)',
                backgroundColor: 'var(--ink)',
                color: '#FAF0E6',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Get Backup
            </button>

            <button
              onClick={async () => {
                try {
                  await api.data.openBackupsFolder();
                } catch {
                  showToast('Could not open backups folder');
                }
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius)',
                border: '1.5px solid var(--ink)',
                backgroundColor: 'transparent',
                color: 'var(--ink)',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Backups Folder
            </button>

            <button
              onClick={handleDeleteAll}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius)',
                border: '1px solid #B00020',
                backgroundColor: 'transparent',
                color: '#B00020',
                fontSize: '0.85rem',
                fontWeight: 500
              }}
            >
              Delete All Data
            </button>
          </div>

          {/* Google Drive Cloud Backup */}
          <div style={{ marginTop: '12px', padding: '14px', borderRadius: 'var(--radius)', border: '1px solid var(--ink-border)', backgroundColor: 'var(--background-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink)' }}>Google Drive Cloud Backup</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '2px' }}>
                  {gdriveStatus.isConnected
                    ? `Connected as ${gdriveStatus.email || 'Google Account'} • Sandboxed AppData folder`
                    : 'Sync automated private snapshots to your personal Google Drive AppData folder.'}
                </div>
              </div>
              {gdriveStatus.isConnected && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#047857' }}>
                  Connected
                </span>
              )}
            </div>

            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              {gdriveStatus.isConnected ? (
                <>
                  <button
                    onClick={async () => {
                      setIsSyncingGdrive(true);
                      try {
                        const res = await api.gdrive.sync();
                        if (res.success) {
                          showToast('Cloud backup synced to Google Drive');
                          const updated = await api.gdrive.getStatus();
                          setGdriveStatus(updated);
                        } else {
                          showToast(res.error || 'Sync failed');
                        }
                      } catch (err: any) {
                        showToast(err.message || 'Sync error');
                      } finally {
                        setIsSyncingGdrive(false);
                      }
                    }}
                    disabled={isSyncingGdrive}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius)',
                      border: '1.5px solid var(--ink)',
                      backgroundColor: 'transparent',
                      color: 'var(--ink)',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: isSyncingGdrive ? 'wait' : 'pointer'
                    }}
                  >
                    {isSyncingGdrive ? 'Syncing...' : 'Sync Now'}
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        await api.gdrive.disconnect();
                        setGdriveStatus({ isConnected: false });
                        showToast('Google Drive disconnected');
                      } catch {
                        showToast('Failed to disconnect');
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius)',
                      border: '1px solid #B00020',
                      backgroundColor: 'transparent',
                      color: '#B00020',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={async () => {
                    setIsConnectingGdrive(true);
                    try {
                      const res = await api.gdrive.connect();
                      if (res.success) {
                        setGdriveStatus({ isConnected: true, email: res.email });
                        showToast(`Connected to Google Drive (${res.email || 'Account'})`);
                        api.gdrive.sync().then(() => {
                          api.gdrive.getStatus().then(setGdriveStatus);
                        });
                      } else {
                        showToast(res.error || 'Connection canceled');
                      }
                    } catch (err: any) {
                      showToast(err.message || 'Connection failed');
                    } finally {
                      setIsConnectingGdrive(false);
                    }
                  }}
                  disabled={isConnectingGdrive}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius)',
                    border: '1.5px solid var(--ink)',
                    backgroundColor: 'var(--ink)',
                    color: '#FAF0E6',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: isConnectingGdrive ? 'wait' : 'pointer'
                  }}
                >
                  {isConnectingGdrive ? 'Opening browser to connect...' : 'Connect Google Drive'}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* About */}
        <section style={{ paddingTop: '16px', borderTop: '1px solid var(--ink-border)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)' }}>Wander</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '2px' }}>
            Version 1.0.4 • Local-first SQLite
          </div>
        </section>
      </div>
    </div>
  );
};
