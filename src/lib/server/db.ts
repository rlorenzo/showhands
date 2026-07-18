import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  is_anonymous INTEGER NOT NULL DEFAULT 1,
  allow_multi INTEGER NOT NULL DEFAULT 0,
  allow_writein INTEGER NOT NULL DEFAULT 0,
  results_visibility TEXT NOT NULL DEFAULT 'live',
  geofence_lat REAL,
  geofence_lng REAL,
  geofence_radius_m INTEGER,
  creator_token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  delete_after INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_writein INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  display_name TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (poll_id, option_id, device_hash)
);

CREATE INDEX IF NOT EXISTS idx_options_poll ON options(poll_id);
CREATE INDEX IF NOT EXISTS idx_votes_poll ON votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_votes_poll_device ON votes(poll_id, device_hash);
CREATE INDEX IF NOT EXISTS idx_polls_delete_after ON polls(delete_after);
`;

export function createDatabase(filename: string): Database.Database {
	if (filename !== ':memory:') {
		fs.mkdirSync(path.dirname(filename), { recursive: true });
	}
	const db = new Database(filename);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.pragma('busy_timeout = 5000');
	db.exec(SCHEMA);
	migrate(db);
	return db;
}

/** Additive migrations for databases created before a column existed.
 * CREATE TABLE IF NOT EXISTS covers fresh files only. */
function migrate(db: Database.Database) {
	const pollCols = (db.pragma("table_info('polls')") as { name: string }[]).map((c) => c.name);
	if (!pollCols.includes('allow_writein')) {
		db.exec('ALTER TABLE polls ADD COLUMN allow_writein INTEGER NOT NULL DEFAULT 0');
	}
	const optionCols = (db.pragma("table_info('options')") as { name: string }[]).map((c) => c.name);
	if (!optionCols.includes('is_writein')) {
		db.exec('ALTER TABLE options ADD COLUMN is_writein INTEGER NOT NULL DEFAULT 0');
	}
}

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
	if (!instance) {
		const file = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'showhands.db');
		instance = createDatabase(file);
	}
	return instance;
}
