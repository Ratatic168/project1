/**
 * Слой доступа к данным. Использует встроенный в Node модуль `node:sqlite`,
 * поэтому нативных зависимостей и компиляции не требуется.
 *
 * Все запросы сосредоточены здесь: при переходе на PostgreSQL достаточно
 * заменить реализацию этих функций, не трогая API и фронтенд.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.WMS_DB ?? resolve(here, '..', 'data', 'wms.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS racks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  x               REAL NOT NULL,
  y               REAL NOT NULL,
  width           REAL NOT NULL,
  depth           REAL NOT NULL,
  levels          INTEGER NOT NULL,
  cells_per_level INTEGER NOT NULL,
  level_height    REAL NOT NULL DEFAULT 0.4
);

CREATE TABLE IF NOT EXISTS locations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  code      TEXT NOT NULL UNIQUE,
  rack_id   INTEGER NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
  level     INTEGER NOT NULL,
  position  INTEGER NOT NULL,
  capacity  INTEGER NOT NULL DEFAULT 12,
  status    TEXT NOT NULL DEFAULT 'free'
);
CREATE INDEX IF NOT EXISTS idx_locations_rack ON locations(rack_id);

CREATE TABLE IF NOT EXISTS products (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  sku      TEXT NOT NULL UNIQUE,
  name     TEXT NOT NULL,
  barcode  TEXT,
  category TEXT,
  width    REAL NOT NULL DEFAULT 0.2,
  height   REAL NOT NULL DEFAULT 0.15,
  depth    REAL NOT NULL DEFAULT 0.2,
  weight   REAL NOT NULL DEFAULT 0.5,
  price    REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  number      TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status      TEXT NOT NULL DEFAULT 'created',
  total       REAL NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  issued_at   TEXT,
  comment     TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty        INTEGER NOT NULL DEFAULT 1,
  location_id INTEGER REFERENCES locations(id),
  status     TEXT NOT NULL DEFAULT 'awaiting'
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS stock (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL REFERENCES products(id),
  location_id   INTEGER NOT NULL REFERENCES locations(id),
  qty           INTEGER NOT NULL,
  order_id      INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  placed_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_location ON stock(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_order ON stock(order_id);

CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        TEXT NOT NULL,
  type      TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id INTEGER,
  message   TEXT NOT NULL,
  payload   TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts DESC);
`;

export function initSchema(): void {
  db.exec(SCHEMA);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Запись события в журнал операций. */
export function logEvent(
  type: string,
  entity: string,
  entityId: number | null,
  message: string,
  payload?: unknown,
): void {
  db.prepare(
    `INSERT INTO events (ts, type, entity, entity_id, message, payload)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(nowIso(), type, entity, entityId, message, payload ? JSON.stringify(payload) : null);
}

/** Транзакция: оборачивает синхронную функцию BEGIN/COMMIT/ROLLBACK. */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
