import Database from 'better-sqlite3';
import { AppSettings } from '../../../src/domain/entities/types';

export const DEFAULT_SETTINGS: AppSettings = {
  timeFormat: '12h',
  reducedMotion: false,
  highContrast: false
};

export class SettingsRepository {
  constructor(private db: Database.Database) {}

  getSettings(): AppSettings {
    const row = this.db.prepare('SELECT value_json FROM app_settings WHERE key = ?').get('app_settings') as any;
    if (!row) return DEFAULT_SETTINGS;
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value_json) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    this.db.prepare(`
      INSERT INTO app_settings (key, value_json) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
    `).run('app_settings', JSON.stringify(updated));
    return updated;
  }
}
