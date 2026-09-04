import { type Cookies, json } from '@sveltejs/kit';
import type { Database } from 'better-sqlite3';
import { getDb } from './db';
import { lookupPollOr404 } from './lookup';
import { type PollRow, verifyCreatorToken } from './polls';

export interface CreatorContext {
	db: Database;
	pollId: string;
	poll: PollRow;
}

/**
 * Shared guard for creator-only endpoints (close / delete / edit).
 * Returns the poll context, or an error Response ready to send back.
 * Unknown polls 404 through the shared, throttled lookup.
 */
export function requireCreatorPoll(
	idParam: string,
	ip: string,
	cookies: Cookies,
	action: string
): CreatorContext | Response {
	const db = getDb();
	const { pollId, poll } = lookupPollOr404(db, idParam, ip);
	const token = cookies.get(`soh_ct_${pollId}`);
	if (!verifyCreatorToken(poll, token)) {
		return json({ error: `Only the poll creator can ${action}.` }, { status: 403 });
	}
	return { db, pollId, poll };
}
