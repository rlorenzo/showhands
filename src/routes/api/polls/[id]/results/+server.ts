import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getPoll, resultsPayload } from '$lib/server/polls';
import { normalizePollId } from '$lib/server/ids';

/** JSON snapshot of results — used as the polling fallback when SSE fails. */
export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();
	const poll = getPoll(db, normalizePollId(params.id));
	if (!poll) {
		return json({ error: 'Poll not found.' }, { status: 404 });
	}
	return json(resultsPayload(db, poll), { headers: { 'cache-control': 'no-store' } });
};
