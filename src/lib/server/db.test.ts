import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from './db';

describe('db migrations', () => {
	let dir: string;
	let file: string;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soh-db-'));
		file = path.join(dir, 'legacy.db');
	});

	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it('backfills write-in columns on a database created before they existed', () => {
		// Build the pre-write-in schema by hand: polls without allow_writein and
		// options without is_writein, plus a row that predates the columns.
		const legacy = new Database(file);
		legacy.exec(`
			CREATE TABLE polls (
				id TEXT PRIMARY KEY,
				question TEXT NOT NULL,
				is_anonymous INTEGER NOT NULL DEFAULT 1,
				allow_multi INTEGER NOT NULL DEFAULT 0,
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
			CREATE TABLE options (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				poll_id TEXT NOT NULL,
				label TEXT NOT NULL,
				position INTEGER NOT NULL
			);
		`);
		legacy
			.prepare(
				`INSERT INTO polls (id, question, creator_token_hash, created_at, expires_at, delete_after)
				 VALUES ('OLD1', 'legacy?', 'hash', 0, 9999999999, 9999999999)`
			)
			.run();
		legacy
			.prepare('INSERT INTO options (poll_id, label, position) VALUES (?, ?, ?)')
			.run('OLD1', 'A', 0);
		legacy.close();

		// Reopen through the production entry point; migrate() must add the columns.
		const db = createDatabase(file);
		const cols = (table: string) =>
			(db.pragma(`table_info('${table}')`) as { name: string }[]).map((c) => c.name);
		expect(cols('polls')).toContain('allow_writein');
		expect(cols('options')).toContain('is_writein');

		// Rows that predate the columns are backfilled to the safe default (off).
		expect(
			(
				db.prepare("SELECT allow_writein FROM polls WHERE id = 'OLD1'").get() as {
					allow_writein: number;
				}
			).allow_writein
		).toBe(0);
		expect(
			(
				db.prepare("SELECT is_writein FROM options WHERE poll_id = 'OLD1'").get() as {
					is_writein: number;
				}
			).is_writein
		).toBe(0);
		db.close();
	});
});
