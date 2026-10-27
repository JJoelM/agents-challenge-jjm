import { createRequire } from 'node:module';
import * as path from 'node:path';
import * as fs from 'node:fs';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

export interface DatabaseSyncInstance {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  close(): void;
}

export class Database {
  private db: DatabaseSyncInstance;

  constructor(filePath?: string) {
    if (filePath && filePath !== ':memory:') {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new DatabaseSync(filePath);
    } else {
      this.db = new DatabaseSync(':memory:');
    }

    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reservations (
        id TEXT PRIMARY KEY,
        unit_id TEXT NOT NULL,
        requester TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_res_unit_status ON reservations (unit_id, status);
      CREATE INDEX IF NOT EXISTS idx_res_interval ON reservations (start_time, end_time);
    `);
  }

  public getRawDb(): DatabaseSyncInstance {
    return this.db;
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public close(): void {
    this.db.close();
  }
}

export const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data', 'reservations.db');

export function createDatabase(customPath?: string): Database {
  return new Database(customPath ?? DEFAULT_DB_PATH);
}
