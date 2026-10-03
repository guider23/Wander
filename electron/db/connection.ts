import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDatabaseSchema } from './schema';

let dbInstance: Database.Database | null = null;

export function getDatabasePath(userDataPath?: string): string {
  if (!userDataPath) {
    // In dev or test fallback
    const legacyPath = path.join(process.cwd(), '.data', 'attention-path.sqlite');
    if (fs.existsSync(legacyPath)) {
      return legacyPath;
    }
    return path.join(process.cwd(), '.data', 'wander.sqlite');
  }
  const dataDir = path.join(userDataPath, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const legacyUserDataPath = path.join(dataDir, 'attention-path.sqlite');
  if (fs.existsSync(legacyUserDataPath)) {
    return legacyUserDataPath;
  }
  return path.join(dataDir, 'wander.sqlite');
}

/**
 * Returns candidate directories where backup snapshots may reside.
 */
export function getCandidateBackupDirs(userDataPath?: string, dbPath?: string): string[] {
  const dirs: string[] = [];
  if (userDataPath) {
    dirs.push(path.join(userDataPath, 'backups'));
  }
  if (dbPath && dbPath !== ':memory:') {
    const parentDir = path.dirname(dbPath);
    dirs.push(path.join(parentDir, '..', 'backups'));
    dirs.push(path.join(parentDir, 'backups'));
  }
  dirs.push(path.join(process.cwd(), '.data', 'backups'));

  const seen = new Set<string>();
  const validDirs: string[] = [];
  for (const d of dirs) {
    const resolved = path.resolve(d);
    if (!seen.has(resolved) && fs.existsSync(resolved)) {
      seen.add(resolved);
      validDirs.push(resolved);
    }
  }
  return validDirs;
}

/**
 * Searches for the newest valid SQLite backup in candidate directories.
 */
export function findLatestSqliteBackup(candidateDirs: string[]): string | null {
  const candidates: { path: string; mtime: number }[] = [];

  for (const dir of candidateDirs) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith('.sqlite') || file.endsWith('.db')) {
          const fullPath = path.join(dir, file);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.size > 0) {
              candidates.push({ path: fullPath, mtime: stat.mtimeMs });
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.mtime - a.mtime);

  for (const c of candidates) {
    try {
      const testDb = new Database(c.path, { readonly: true, timeout: 2000 });
      testDb.prepare('PRAGMA schema_version').get();
      testDb.close();
      return c.path;
    } catch (err) {
      console.warn(`[Database Recovery] Candidate SQLite backup invalid (${c.path}):`, err);
    }
  }

  return null;
}

/**
 * Searches for the newest valid JSON backup in candidate directories.
 */
export function findLatestJsonBackup(candidateDirs: string[]): string | null {
  const candidates: { path: string; mtime: number }[] = [];

  for (const dir of candidateDirs) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const fullPath = path.join(dir, file);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.size > 0) {
              candidates.push({ path: fullPath, mtime: stat.mtimeMs });
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.mtime - a.mtime);

  for (const c of candidates) {
    try {
      const content = fs.readFileSync(c.path, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return c.path;
      }
    } catch (err) {
      console.warn(`[Database Recovery] Candidate JSON backup invalid (${c.path}):`, err);
    }
  }

  return null;
}

/**
 * If original database does not exist or is 0 bytes, copies the latest valid SQLite backup.
 */
export function restoreSqliteBackupIfOriginalNotFound(dbPath: string, userDataPath?: string): boolean {
  if (dbPath === ':memory:') return false;

  const dbExists = fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0;
  if (dbExists) return false;

  const candidateDirs = getCandidateBackupDirs(userDataPath, dbPath);
  const latestBackup = findLatestSqliteBackup(candidateDirs);

  if (!latestBackup) return false;

  try {
    const targetDir = path.dirname(dbPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
    if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);

    fs.copyFileSync(latestBackup, dbPath);
    console.log(`[Database Recovery] Original DB not found. Restored from SQLite backup: ${latestBackup}`);
    return true;
  } catch (err) {
    console.error(`[Database Recovery] Failed to copy SQLite backup (${latestBackup}) to ${dbPath}:`, err);
    return false;
  }
}

export function createDatabaseConnection(dbPath: string, userDataPath?: string): Database.Database {
  const dir = path.dirname(dbPath);
  if (dbPath !== ':memory:' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (dbPath !== ':memory:') {
    restoreSqliteBackupIfOriginalNotFound(dbPath, userDataPath);
  }

  let db: Database.Database;
  try {
    db = new Database(dbPath);
    initDatabaseSchema(db);
  } catch (err) {
    if (dbPath !== ':memory:') {
      console.error('[Database Recovery] Database initialization error. Attempting backup recovery:', err);
      try {
        const corruptPath = `${dbPath}.corrupted-${Date.now()}`;
        if (fs.existsSync(dbPath)) fs.renameSync(dbPath, corruptPath);
        if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
        if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
      } catch (_) {}

      restoreSqliteBackupIfOriginalNotFound(dbPath, userDataPath);
      db = new Database(dbPath);
      initDatabaseSchema(db);
    } else {
      throw err;
    }
  }

  return db;
}

export function getDatabase(userDataPath?: string): Database.Database {
  if (!dbInstance) {
    const dbPath = getDatabasePath(userDataPath);
    dbInstance = createDatabaseConnection(dbPath, userDataPath);
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
