import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getPoll, verifyCreatorToken, deletePoll, updateRadius, publishResults } from '$lib/server/polls';
import { normalizePollId } from '$lib/server/ids';
import { isValidRadius } from '$lib/validation';

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const db = getDb();
	const pollId = normalizePollId(params.id);
	const poll = getPoll(db, pollId);
	if (!poll) {
		return json({ error: 'Poll not found.' }, { status: 404 });
	}
	const token = cookies.get(`soh_ct_${pollId}`);
	if (!verifyCreatorToken(poll, token)) {
		return json({ error: 'Only the poll creator can delete it.' }, { status: 403 });
	}
	deletePoll(db, pollId);
	cookies.delete(`soh_ct_${pollId}`, { path: '/' });
	return json({ ok: true });
};

/** Creator can widen/narrow the geofence radius (e.g. friends indoors getting rejected). */
export const PATCH: RequestHandler = async ({ params, request, cookies }) => {
	const db = getDb();
	const pollId = normalizePollId(params.id);
	const poll = getPoll(db, pollId);
	if (!poll) {
		return json({ error: 'Poll not found.' }, { status: 404 });
	}
	const token = cookies.get(`soh_ct_${pollId}`);
	if (!verifyCreatorToken(poll, token)) {
		return json({ error: 'Only the poll creator can edit it.' }, { status: 403 });
	}
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body.' }, { status: 400 });
	}
	if (!isValidRadius(body.radiusM)) {
		return json({ error: 'Invalid radius.' }, { status: 400 });
	}
	if (poll.geofence_radius_m === null) {
		return json({ error: 'This poll has no geofence.' }, { status: 400 });
	}
	updateRadius(db, pollId, body.radiusM);
	const updated = getPoll(db, pollId);
	if (updated) publishResults(db, updated);
	return json({ ok: true, radiusM: body.radiusM });
};
