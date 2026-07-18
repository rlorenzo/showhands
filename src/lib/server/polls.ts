import type { Database } from 'better-sqlite3';
import type { PollView } from '$lib/types';
import { GRACE_SECONDS, OPTIONS_MIN, WRITEIN_TOTAL_MAX } from '$lib/validation';
import { closeChannel, publish, type ResultsPayload } from './broadcast';
import { roundCoord } from './geo';
import { generatePollId } from './ids';
import { creatorTokenHash, newRandomToken, safeEqualHex } from './tokens';

export interface PollRow {
	id: string;
	question: string;
	is_anonymous: number;
	allow_multi: number;
	allow_writein: number;
	results_visibility: 'live' | 'after_close';
	geofence_lat: number | null;
	geofence_lng: number | null;
	geofence_radius_m: number | null;
	creator_token_hash: string;
	status: 'open' | 'closed';
	created_at: number;
	expires_at: number;
	delete_after: number;
}

export interface OptionRow {
	id: number;
	poll_id: string;
	label: string;
	position: number;
	is_writein: number;
}

export function nowSeconds(): number {
	return Math.floor(Date.now() / 1000);
}

export interface CreatePollInput {
	question: string;
	options: string[];
	isAnonymous: boolean;
	allowMulti: boolean;
	allowWritein: boolean;
	resultsVisibility: 'live' | 'after_close';
	geofence: { lat: number; lng: number; radiusM: number } | null;
	expiresInSeconds: number;
}

export function createPoll(
	db: Database,
	input: CreatePollInput,
	now = nowSeconds()
): { id: string; creatorToken: string; deleteAfter: number } {
	const creatorToken = newRandomToken();
	const tokenHash = creatorTokenHash(creatorToken);
	const expiresAt = now + input.expiresInSeconds;
	const deleteAfter = expiresAt + GRACE_SECONDS;

	const insertPoll = db.prepare(
		`INSERT INTO polls (id, question, is_anonymous, allow_multi, allow_writein, results_visibility,
			geofence_lat, geofence_lng, geofence_radius_m, creator_token_hash,
			status, created_at, expires_at, delete_after)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`
	);
	const insertOption = db.prepare(
		'INSERT INTO options (poll_id, label, position) VALUES (?, ?, ?)'
	);

	// Retry on the rare ID collision (~920k combos).
	const txn = db.transaction(() => {
		for (let attempt = 0; attempt < 10; attempt++) {
			const id = generatePollId();
			try {
				insertPoll.run(
					id,
					input.question,
					input.isAnonymous ? 1 : 0,
					input.allowMulti ? 1 : 0,
					input.allowWritein ? 1 : 0,
					input.resultsVisibility,
					input.geofence ? roundCoord(input.geofence.lat) : null,
					input.geofence ? roundCoord(input.geofence.lng) : null,
					input.geofence ? input.geofence.radiusM : null,
					tokenHash,
					now,
					expiresAt,
					deleteAfter
				);
			} catch (err) {
				if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_PRIMARYKEY') continue;
				throw err;
			}
			input.options.forEach((label, i) => {
				insertOption.run(id, label, i);
			});
			return id;
		}
		throw new Error('could not allocate poll id');
	});

	return { id: txn(), creatorToken, deleteAfter };
}

/** Returns the poll only while it should still be visible (pre delete_after). */
export function getPoll(db: Database, id: string, now = nowSeconds()): PollRow | null {
	const row = db.prepare('SELECT * FROM polls WHERE id = ?').get(id) as PollRow | undefined;
	if (!row) return null;
	if (row.delete_after <= now) return null; // gone even if the sweep hasn't run yet
	return row;
}

export function getOptions(db: Database, pollId: string): OptionRow[] {
	return db
		.prepare('SELECT * FROM options WHERE poll_id = ? ORDER BY position')
		.all(pollId) as OptionRow[];
}

/** A poll is effectively closed once past expires_at, even before the sweep marks it. */
export function effectiveStatus(poll: PollRow, now = nowSeconds()): 'open' | 'closed' {
	if (poll.status === 'closed') return 'closed';
	return poll.expires_at <= now ? 'closed' : 'open';
}

export function toPollView(poll: PollRow, options: OptionRow[], now = nowSeconds()): PollView {
	return {
		id: poll.id,
		question: poll.question,
		isAnonymous: poll.is_anonymous === 1,
		allowMulti: poll.allow_multi === 1,
		allowWritein: poll.allow_writein === 1,
		resultsVisibility: poll.results_visibility,
		geofenced: poll.geofence_radius_m !== null,
		geofenceRadiusM: poll.geofence_radius_m,
		status: effectiveStatus(poll, now),
		createdAt: poll.created_at,
		expiresAt: poll.expires_at,
		options: options.map((o) => ({ id: o.id, label: o.label }))
	};
}

/** Dedupe key for write-in labels: fold case and Unicode compatibility forms
 * so "Pizza", "pizza" and full-width variants merge instead of splitting votes. */
function writeInKey(label: string): string {
	return label.normalize('NFKC').toLowerCase();
}

/**
 * Resolve a voter write-in to an option id. Reuses an existing option when the
 * label matches (case/Unicode-insensitively); otherwise appends a new one,
 * unless the poll already carries WRITEIN_TOTAL_MAX options.
 */
export function addWriteInOption(
	db: Database,
	pollId: string,
	label: string
): { id: number } | { full: true } {
	const txn = db.transaction((): { id: number } | { full: true } => {
		const options = getOptions(db, pollId);
		const key = writeInKey(label);
		const existing = options.find((o) => writeInKey(o.label) === key);
		if (existing) return { id: existing.id };
		if (options.length >= WRITEIN_TOTAL_MAX) return { full: true };
		const position = options.length === 0 ? 0 : options[options.length - 1].position + 1;
		const result = db
			.prepare('INSERT INTO options (poll_id, label, position, is_writein) VALUES (?, ?, ?, 1)')
			.run(pollId, label, position);
		return { id: Number(result.lastInsertRowid) };
	});
	return txn();
}

/**
 * Creator moderation: remove one option (and, via cascade, its votes).
 * A poll never drops below OPTIONS_MIN options, so it stays votable.
 */
export function deleteOption(
	db: Database,
	pollId: string,
	optionId: number
): 'deleted' | 'not_found' | 'min_reached' {
	const txn = db.transaction((): 'deleted' | 'not_found' | 'min_reached' => {
		const options = getOptions(db, pollId);
		if (!options.some((o) => o.id === optionId)) return 'not_found';
		if (options.length <= OPTIONS_MIN) return 'min_reached';
		db.prepare('DELETE FROM options WHERE id = ? AND poll_id = ?').run(optionId, pollId);
		return 'deleted';
	});
	return txn();
}

/**
 * Drop voter write-in options that no longer hold any vote — e.g. a voter added
 * a write-in, then changed their mind and recast, leaving it abandoned. Only
 * write-ins (is_writein = 1) are eligible; seeded options are never touched, so
 * a poll can't fall below its original set. Returns the number pruned.
 */
export function pruneOrphanWriteins(db: Database, pollId: string): number {
	const result = db
		.prepare(
			`DELETE FROM options
			 WHERE poll_id = ? AND is_writein = 1
			   AND id NOT IN (SELECT option_id FROM votes WHERE poll_id = ?)`
		)
		.run(pollId, pollId);
	return result.changes;
}

export interface CastVoteInput {
	pollId: string;
	deviceHash: string;
	optionIds: number[];
	displayName: string | null;
}

/** Replaces any previous vote by this device (change-my-vote semantics). */
export function castVote(db: Database, input: CastVoteInput, now = nowSeconds()): void {
	const txn = db.transaction(() => {
		db.prepare('DELETE FROM votes WHERE poll_id = ? AND device_hash = ?').run(
			input.pollId,
			input.deviceHash
		);
		const insert = db.prepare(
			'INSERT INTO votes (poll_id, option_id, device_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)'
		);
		for (const optionId of input.optionIds) {
			insert.run(input.pollId, optionId, input.deviceHash, input.displayName, now);
		}
	});
	txn();
}

export function getDeviceVote(
	db: Database,
	pollId: string,
	deviceHash: string
): { optionIds: number[]; displayName: string | null } | null {
	const rows = db
		.prepare('SELECT option_id, display_name FROM votes WHERE poll_id = ? AND device_hash = ?')
		.all(pollId, deviceHash) as { option_id: number; display_name: string | null }[];
	if (rows.length === 0) return null;
	return { optionIds: rows.map((r) => r.option_id), displayName: rows[0].display_name };
}

export function getCounts(
	db: Database,
	pollId: string
): { counts: Record<string, number>; total: number } {
	const rows = db
		.prepare('SELECT option_id, COUNT(*) AS n FROM votes WHERE poll_id = ? GROUP BY option_id')
		.all(pollId) as { option_id: number; n: number }[];
	const counts: Record<string, number> = {};
	for (const r of rows) counts[String(r.option_id)] = r.n;
	const total = (
		db
			.prepare('SELECT COUNT(DISTINCT device_hash) AS n FROM votes WHERE poll_id = ?')
			.get(pollId) as {
			n: number;
		}
	).n;
	return { counts, total };
}

export function getVoterNames(db: Database, pollId: string): string[] {
	return (
		db
			.prepare(
				`SELECT DISTINCT display_name FROM votes
				 WHERE poll_id = ? AND display_name IS NOT NULL
				 ORDER BY display_name COLLATE NOCASE`
			)
			.all(pollId) as { display_name: string }[]
	).map((r) => r.display_name);
}

/** Snapshot of live results, honoring results_visibility. */
export function resultsPayload(db: Database, poll: PollRow, now = nowSeconds()): ResultsPayload {
	const status = effectiveStatus(poll, now);
	const hidden = poll.results_visibility === 'after_close' && status === 'open';
	const { counts, total } = getCounts(db, poll.id);
	return {
		status,
		total,
		options: getOptions(db, poll.id).map((o) => ({ id: o.id, label: o.label })),
		counts: hidden ? null : counts,
		voters: hidden || poll.is_anonymous === 1 ? null : getVoterNames(db, poll.id),
		closesAt: poll.expires_at,
		serverNow: now
	};
}

export function publishResults(db: Database, poll: PollRow, now = nowSeconds()): void {
	publish(poll.id, resultsPayload(db, poll, now));
}

export function verifyCreatorToken(poll: PollRow, token: string | undefined | null): boolean {
	if (!token) return false;
	return safeEqualHex(poll.creator_token_hash, creatorTokenHash(token));
}

export function closePoll(db: Database, pollId: string, now = nowSeconds()): void {
	db.prepare(
		"UPDATE polls SET status = 'closed', expires_at = MIN(expires_at, ?) WHERE id = ?"
	).run(now, pollId);
}

export function deletePoll(db: Database, pollId: string): void {
	db.prepare('DELETE FROM polls WHERE id = ?').run(pollId);
	closeChannel(pollId);
}

export function updateRadius(db: Database, pollId: string, radiusM: number): void {
	db.prepare(
		'UPDATE polls SET geofence_radius_m = ? WHERE id = ? AND geofence_radius_m IS NOT NULL'
	).run(radiusM, pollId);
}

/**
 * Expiry sweep. Closes polls past expires_at (notifying live watchers) and
 * hard-deletes polls past delete_after (cascade removes options + votes).
 * Runs at boot and every 5 minutes.
 */
export function sweep(db: Database, now = nowSeconds()): { closed: number; deleted: number } {
	const toClose = db
		.prepare("SELECT id FROM polls WHERE status = 'open' AND expires_at <= ?")
		.all(now) as { id: string }[];
	if (toClose.length > 0) {
		db.prepare("UPDATE polls SET status = 'closed' WHERE status = 'open' AND expires_at <= ?").run(
			now
		);
		for (const { id } of toClose) {
			const poll = getPoll(db, id, now);
			if (poll) publishResults(db, poll, now);
		}
	}

	const toDelete = db.prepare('SELECT id FROM polls WHERE delete_after <= ?').all(now) as {
		id: string;
	}[];
	for (const { id } of toDelete) {
		deletePoll(db, id);
	}
	return { closed: toClose.length, deleted: toDelete.length };
}
