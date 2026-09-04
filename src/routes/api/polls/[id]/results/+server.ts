import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { lookupPollOr404 } from '$lib/server/lookup';
import { resultsPayload } from '$lib/server/polls';
import type { RequestHandler } from './$types';

/** JSON snapshot of results — used as the polling fallback when SSE fails. */
export const GET: RequestHandler = async ({ params, getClientAddress }) => {
	const db = getDb();
	const { poll } = lookupPollOr404(db, params.id, getClientAddress());
	return json(resultsPayload(db, poll), { headers: { 'cache-control': 'no-store' } });
};
