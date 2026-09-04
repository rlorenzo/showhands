import { error } from '@sveltejs/kit';
import type { Database } from 'better-sqlite3';
import { isValidPollIdShape, normalizePollId } from './ids';
import { getPoll, type PollRow } from './polls';
import { allow, LIMITS } from './ratelimit';

/**
 * Resolve a poll from its URL param or throw a 404. Every public lookup routes
 * through here so the miss throttle applies uniformly: the 920k-code ID space
 * can't be enumerated via whichever endpoint happens to lack a check. Missing
 * and expired polls 404 identically.
 */
export function lookupPollOr404(
	db: Database,
	rawId: string,
	ip: string
): { pollId: string; poll: PollRow } {
	const pollId = normalizePollId(rawId);
	const poll = isValidPollIdShape(pollId) ? getPoll(db, pollId) : null;
	if (poll) return { pollId, poll };
	if (!allow(`miss:${ip}`, LIMITS.lookupMiss.max, LIMITS.lookupMiss.windowMs)) {
		error(429, 'Too many lookups. Slow down.');
	}
	error(404, 'Poll not found');
}
