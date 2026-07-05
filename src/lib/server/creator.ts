import { type Cookies, json } from '@sveltejs/kit';
import type { Database } from 'better-sqlite3';
import { getDb } from './db';
import { normalizePollId } from './ids';
import { getPoll, type PollRow, verifyCreatorToken } from './polls';

export interface CreatorContext {
	db: Database;
	pollId: string;
	poll: PollRow;
}

/**
 * Shared guard for creator-only endpoints (close / delete / edit).
 * Returns the poll context, or an error Response ready to send back.
 */
export function requireCreatorPoll(
	idParam: string,
	cookies: Cookies,
	action: string
): CreatorContext | Response {
	const db = getDb();
	const pollId = normalizePollId(idParam);
	const poll = getPoll(db, pollId);
	if (!poll) {
		return json({ error: 'Poll not found.' }, { status: 404 });
	}
	const token = cookies.get(`soh_ct_${pollId}`);
	if (!verifyCreatorToken(poll, token)) {
		return json({ error: `Only the poll creator can ${action}.` }, { status: 403 });
	}
	return { db, pollId, poll };
}
