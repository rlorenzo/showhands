import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import {
	getPoll,
	getOptions,
	effectiveStatus,
	castVote,
	publishResults,
	resultsPayload
} from '$lib/server/polls';
import { deviceHashForPoll } from '$lib/server/tokens';
import { allow, LIMITS } from '$lib/server/ratelimit';
import { checkGeofence, isValidLatLng } from '$lib/server/geo';
import { normalizePollId } from '$lib/server/ids';
import { sanitizeText, NAME_MAX } from '$lib/validation';

export const POST: RequestHandler = async ({ params, request, locals, getClientAddress }) => {
	const ip = getClientAddress();
	const pollId = normalizePollId(params.id);

	if (!allow(`vote:${ip}`, LIMITS.votePerIp.max, LIMITS.votePerIp.windowMs)) {
		return json({ error: 'Too many votes from this network. Try again later.' }, { status: 429 });
	}
	if (!allow(`vote:${ip}:${pollId}`, LIMITS.votePerIpPoll.max, LIMITS.votePerIpPoll.windowMs)) {
		return json({ error: 'Too many votes on this poll from this network.' }, { status: 429 });
	}

	const db = getDb();
	const poll = getPoll(db, pollId);
	if (!poll) {
		return json({ error: 'Poll not found.' }, { status: 404 });
	}
	if (effectiveStatus(poll) === 'closed') {
		return json({ error: 'This poll is closed.' }, { status: 409 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body.' }, { status: 400 });
	}

	// Geofence: validated in memory only. Voter coordinates are never
	// persisted or logged — only pass/fail leaves this handler.
	if (poll.geofence_radius_m !== null && poll.geofence_lat !== null && poll.geofence_lng !== null) {
		const lat = body.lat;
		const lng = body.lng;
		const accuracy = typeof body.accuracy === 'number' ? body.accuracy : undefined;
		if (!isValidLatLng(lat, lng)) {
			return json(
				{ error: 'This poll is limited to people near its creator. Location is required to vote.' },
				{ status: 403, headers: { 'x-reason': 'geofence-missing' } }
			);
		}
		const check = checkGeofence(
			poll.geofence_lat,
			poll.geofence_lng,
			poll.geofence_radius_m,
			lat as number,
			lng as number,
			accuracy
		);
		if (!check.ok) {
			return json(
				{
					error: 'You are outside this poll’s area.',
					distanceM: Math.round(check.distanceM),
					radiusM: poll.geofence_radius_m
				},
				{ status: 403, headers: { 'x-reason': 'geofence-outside' } }
			);
		}
	}

	const options = getOptions(db, pollId);
	const validIds = new Set(options.map((o) => o.id));
	const rawIds = Array.isArray(body.optionIds) ? body.optionIds : [];
	const optionIds = [...new Set(rawIds.filter((v): v is number => typeof v === 'number'))];
	if (optionIds.length === 0 || optionIds.some((id) => !validIds.has(id))) {
		return json({ error: 'Pick at least one valid option.' }, { status: 400 });
	}
	if (poll.allow_multi !== 1 && optionIds.length > 1) {
		return json({ error: 'This poll allows a single choice.' }, { status: 400 });
	}

	let displayName: string | null = null;
	if (poll.is_anonymous !== 1) {
		displayName = sanitizeText(body.displayName, NAME_MAX) || null;
		if (!displayName) {
			return json({ error: 'This poll asks for your name.' }, { status: 400 });
		}
	}
	// When anonymous, refuse to persist a name even if the client sent one.

	const deviceHash = deviceHashForPoll(locals.deviceId, pollId);
	castVote(db, { pollId, deviceHash, optionIds, displayName });
	publishResults(db, poll);

	return json({ ok: true, results: resultsPayload(db, poll) });
};
