import Database from 'better-sqlite3';
import path from 'path';
import { Document } from './types.js';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'collabpad.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    migrate(db);
  }
  return db;
}

export function initDb(customPath?: string): Database.Database {
  if (customPath) {
    db = new Database(customPath);
  } else {
    db = new Database(DB_PATH);
  }
  db.pragma('journal_mode = WAL');
  migrate(db);
  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled',
      content TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

// Queries
export function getAllDocuments(): Pick<Document, 'id' | 'title' | 'updated_at'>[] {
  return getDb()
    .prepare('SELECT id, title, updated_at FROM documents ORDER BY updated_at DESC')
    .all() as Pick<Document, 'id' | 'title' | 'updated_at'>[];
}

export function getDocument(id: string): Document | undefined {
  return getDb()
    .prepare('SELECT * FROM documents WHERE id = ?')
    .get(id) as Document | undefined;
}

export function createDocument(id: string, title: string): Document {
  getDb()
    .prepare('INSERT INTO documents (id, title) VALUES (?, ?)')
    .run(id, title);
  return getDocument(id)!;
}

export function updateDocument(
  id: string,
  content: string,
  version: number
): Document | undefined {
  const result = getDb()
    .prepare(
      `UPDATE documents SET content = ?, version = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .run(content, version, id);
  if (result.changes === 0) return undefined;
  return getDocument(id);
}

export function updateDocumentTitle(id: string, title: string): Document | undefined {
  const result = getDb()
    .prepare(`UPDATE documents SET title = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(title, id);
  if (result.changes === 0) return undefined;
  return getDocument(id);
}

export function deleteDocument(id: string): boolean {
  const result = getDb().prepare('DELETE FROM documents WHERE id = ?').run(id);
  return result.changes > 0;
}
