import type { RequestHandler } from '@sveltejs/kit';
import { version } from '$app/environment';
import { getDb } from '$lib/server/db';

/** Cheap liveness endpoint for deploy gates and uptime monitors.
 * The trivial query catches a corrupted or locked database, not just
 * process liveness; any throw surfaces as a 500.
 *
 * `commit` is the commit this bundle was built from. A 200 alone cannot
 * distinguish a fresh deploy from a restart that kept the old bundle, so the
 * deploy gate asserts this matches the commit it just deployed. */
export const GET: RequestHandler = () => {
	getDb().prepare('SELECT 1').get();
	return new Response(JSON.stringify({ status: 'ok', commit: version }), {
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
	});
};
