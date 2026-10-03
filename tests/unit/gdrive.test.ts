import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabaseSchema } from '../../electron/db/schema';
import { GoogleDriveService } from '../../electron/services/google-drive';
import { ApplicationService } from '../../electron/application/service';

describe('GoogleDriveService Tests', () => {
  let db: Database.Database;
  let gdrive: GoogleDriveService;

  beforeEach(() => {
    db = new Database(':memory:');
    initDatabaseSchema(db);
    gdrive = new GoogleDriveService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('reports isConnected as false initially', () => {
    const status = gdrive.getStatus();
    expect(status.isConnected).toBe(false);
    expect(status.email).toBeUndefined();
    expect(status.lastSyncAt).toBeUndefined();
  });

  it('correctly reads status when tokens are stored', () => {
    db.prepare(`
      INSERT INTO app_settings (key, value_json) VALUES (?, ?)
    `).run(
      'google_drive_auth',
      JSON.stringify({
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        expiresAt: Date.now() + 3600000,
        email: 'wander.user@gmail.com',
        lastSyncAt: '2026-10-03T10:00:00.000Z'
      })
    );

    const status = gdrive.getStatus();
    expect(status.isConnected).toBe(true);
    expect(status.email).toBe('wander.user@gmail.com');
    expect(status.lastSyncAt).toBe('2026-10-03T10:00:00.000Z');
  });

  it('disconnects and clears stored credentials', () => {
    db.prepare(`
      INSERT INTO app_settings (key, value_json) VALUES (?, ?)
    `).run(
      'google_drive_auth',
      JSON.stringify({
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        expiresAt: Date.now() + 3600000,
        email: 'wander.user@gmail.com'
      })
    );

    expect(gdrive.getStatus().isConnected).toBe(true);

    const result = gdrive.disconnect();
    expect(result.success).toBe(true);
    expect(gdrive.getStatus().isConnected).toBe(false);
  });

  it('returns valid access token when unexpired', async () => {
    const future = Date.now() + 300000;
    db.prepare(`
      INSERT INTO app_settings (key, value_json) VALUES (?, ?)
    `).run(
      'google_drive_auth',
      JSON.stringify({
        accessToken: 'valid_cached_token',
        refreshToken: 'mock_refresh_token',
        expiresAt: future,
        email: 'wander.user@gmail.com'
      })
    );

    const token = await gdrive.getValidAccessToken();
    expect(token).toBe('valid_cached_token');
  });

  it('integrates with ApplicationService for auto-sync', () => {
    const appService = new ApplicationService(db);
    expect(appService.googleDrive).toBeDefined();
    expect(appService.googleDrive.getStatus().isConnected).toBe(false);

    // Starting work creates a backup snapshot cleanly without errors
    const work = appService.startWork('Cloud Synced Work');
    expect(work.node.title).toBe('Cloud Synced Work');
  });

  it('rejects cloud restore when Google Drive is disconnected', async () => {
    const appService = new ApplicationService(db);
    const result = await appService.restoreFromCloudBackup();
    expect(result.success).toBe(false);
    expect(result.error).toContain('not connected');
  });

  it('returns null for latest cloud backup when no token exists', async () => {
    const latest = await gdrive.getLatestCloudBackup();
    expect(latest).toBeNull();
  });
});
