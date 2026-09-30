import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type DB = DatabaseSync;

export function openDb(path: string): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS launches (
      mint TEXT PRIMARY KEY,
      creator TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      uri TEXT NOT NULL,
      image TEXT,
      description TEXT,
      created_at INTEGER NOT NULL,
      dev_buy TEXT NOT NULL,
      state TEXT NOT NULL,
      d1 INTEGER, d2 INTEGER, liquid_bps INTEGER,
      fog_tick INTEGER DEFAULT 0,
      opened_at INTEGER, completed_at INTEGER, graduated_at INTEGER,
      pool TEXT,
      virtual_sol TEXT, virtual_tokens TEXT, real_sol TEXT, real_tokens TEXT,
      volume_sol TEXT DEFAULT '0',
      coef_bps INTEGER DEFAULT 10000,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS trades (
      sig TEXT NOT NULL, ix INTEGER NOT NULL,
      mint TEXT NOT NULL, trader TEXT NOT NULL, is_buy INTEGER NOT NULL,
      sol TEXT NOT NULL, tokens TEXT NOT NULL, price REAL NOT NULL,
      ts INTEGER NOT NULL, slot INTEGER NOT NULL,
      PRIMARY KEY (sig, ix)
    );
    CREATE INDEX IF NOT EXISTS trades_mint_ts ON trades (mint, ts);
    CREATE TABLE IF NOT EXISTS events (
      sig TEXT NOT NULL, ix INTEGER NOT NULL,
      mint TEXT, kind TEXT NOT NULL, data TEXT NOT NULL, ts INTEGER NOT NULL, slot INTEGER NOT NULL,
      PRIMARY KEY (sig, ix)
    );
    CREATE INDEX IF NOT EXISTS events_mint ON events (mint, ts);
    CREATE TABLE IF NOT EXISTS epochs (
      mint TEXT NOT NULL, idx INTEGER NOT NULL, root TEXT NOT NULL, total TEXT NOT NULL,
      slot INTEGER NOT NULL, posted_at INTEGER NOT NULL,
      PRIMARY KEY (mint, idx)
    );
    CREATE TABLE IF NOT EXISTS allocations (
      mint TEXT NOT NULL, idx INTEGER NOT NULL, holder TEXT NOT NULL,
      amount TEXT NOT NULL, proof TEXT NOT NULL, claimed INTEGER DEFAULT 0,
      PRIMARY KEY (mint, idx, holder)
    );
    CREATE INDEX IF NOT EXISTS allocations_holder ON allocations (holder);
    CREATE TABLE IF NOT EXISTS metadata (
      id TEXT PRIMARY KEY, json TEXT NOT NULL, image BLOB, mime TEXT
    );
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  return db;
}

export const kvGet = (db: DB, key: string) =>
  (db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined)?.value;

export const kvSet = (db: DB, key: string, value: string) =>
  db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
