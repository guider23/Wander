import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initDatabaseSchema } from './schema';

let dbInstance: Database.Database | null = null;

export function getDatabasePath(userDataPath?: string): string {
  if (!userDataPath) {
    // In dev or test fallback
    return path.join(process.cwd(), '.data', 'attention-path.sqlite');
  }
  const dataDir = path.join(userDataPath, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'attention-path.sqlite');
}

export function createDatabaseConnection(dbPath: string): Database.Database {
  const dir = path.dirname(dbPath);
  if (dbPath !== ':memory:' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  initDatabaseSchema(db);
  return db;
}

export function getDatabase(userDataPath?: string): Database.Database {
  if (!dbInstance) {
    const dbPath = getDatabasePath(userDataPath);
    dbInstance = createDatabaseConnection(dbPath);
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
