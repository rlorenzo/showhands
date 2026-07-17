import type { RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

/** Cheap liveness endpoint for deploy gates and uptime monitors.
 * The trivial query catches a corrupted or locked database, not just
 * process liveness; any throw surfaces as a 500. */
export const GET: RequestHandler = () => {
	getDb().prepare('SELECT 1').get();
	return new Response('ok', { headers: { 'content-type': 'text/plain' } });
};
