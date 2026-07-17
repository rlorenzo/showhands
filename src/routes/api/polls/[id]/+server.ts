import { json } from '@sveltejs/kit';
import { requireCreatorPoll } from '$lib/server/creator';
import { deletePoll, getPoll, publishResults, updateRadius } from '$lib/server/polls';
import { isValidRadius } from '$lib/validation';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const ctx = requireCreatorPoll(params.id, cookies, 'delete it');
	if (ctx instanceof Response) return ctx;

	deletePoll(ctx.db, ctx.pollId);
	cookies.delete(`soh_ct_${ctx.pollId}`, { path: '/' });
	return json({ ok: true });
};

/** Creator can widen/narrow the geofence radius (e.g. friends indoors getting rejected). */
export const PATCH: RequestHandler = async ({ params, request, cookies }) => {
	const ctx = requireCreatorPoll(params.id, cookies, 'edit it');
	if (ctx instanceof Response) return ctx;

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body.' }, { status: 400 });
	}
	if (!isValidRadius(body.radiusM)) {
		return json({ error: 'Invalid radius.' }, { status: 400 });
	}
	if (ctx.poll.geofence_radius_m === null) {
		return json({ error: 'This poll has no geofence.' }, { status: 400 });
	}
	updateRadius(ctx.db, ctx.pollId, body.radiusM);
	const updated = getPoll(ctx.db, ctx.pollId);
	if (updated) publishResults(ctx.db, updated);
	return json({ ok: true, radiusM: body.radiusM });
};
