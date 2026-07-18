import { json } from '@sveltejs/kit';
import type { Database } from 'better-sqlite3';
import { getDb } from '$lib/server/db';
import { checkGeofence, isValidLatLng } from '$lib/server/geo';
import { normalizePollId } from '$lib/server/ids';
import {
	addWriteInOption,
	castVote,
	effectiveStatus,
	getOptions,
	getPoll,
	type PollRow,
	pruneOrphanWriteins,
	publishResults,
	resultsPayload
} from '$lib/server/polls';
import { allow, LIMITS } from '$lib/server/ratelimit';
import { deviceHashForPoll } from '$lib/server/tokens';
import { NAME_MAX, OPTION_MAX, sanitizeText, WRITEIN_TOTAL_MAX } from '$lib/validation';
import type { RequestHandler } from './$types';

/**
 * Geofence gate. Voter coordinates are validated in memory only — never
 * persisted or logged; only pass/fail leaves this handler. Returns an error
 * Response to send back, or null when the vote may proceed.
 */
function geofenceGate(poll: PollRow, body: Record<string, unknown>): Response | null {
	if (poll.geofence_radius_m === null || poll.geofence_lat === null || poll.geofence_lng === null) {
		return null;
	}
	const { lat, lng } = body;
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
	return null;
}

/**
 * Resolve the option ids to record: the picked options plus an optional
 * write-in (sanitized, single-choice-enforced, merged, capped). Returns the id
 * list, or an error Response when the selection is invalid.
 */
function resolveOptionIds(
	db: Database,
	poll: PollRow,
	pollId: string,
	body: Record<string, unknown>
): Response | number[] {
	const validIds = new Set(getOptions(db, pollId).map((o) => o.id));
	const rawIds = Array.isArray(body.optionIds) ? body.optionIds : [];
	const picked = [...new Set(rawIds.filter((v): v is number => typeof v === 'number'))];
	if (picked.some((id) => !validIds.has(id))) {
		return json({ error: 'Pick at least one valid option.' }, { status: 400 });
	}

	// Voter write-in: sanitized like any option, merged case-insensitively into
	// an existing option when the label matches, capped in total per poll.
	let writeIn = '';
	if (typeof body.writeIn === 'string' && body.writeIn.trim().length > 0) {
		if (poll.allow_writein !== 1) {
			return json({ error: 'This poll does not accept write-in options.' }, { status: 400 });
		}
		writeIn = sanitizeText(body.writeIn, OPTION_MAX);
	}
	// Enforce single-choice before inserting, so a rejected vote never leaves
	// behind a zero-vote write-in option.
	if (poll.allow_multi !== 1 && picked.length + (writeIn ? 1 : 0) > 1) {
		return json({ error: 'This poll allows a single choice.' }, { status: 400 });
	}

	const optionIds = new Set(picked);
	if (writeIn) {
		const resolved = addWriteInOption(db, pollId, writeIn);
		if ('full' in resolved) {
			return json(
				{ error: `This poll already has the maximum of ${WRITEIN_TOTAL_MAX} options.` },
				{ status: 409, headers: { 'x-reason': 'writein-full' } }
			);
		}
		optionIds.add(resolved.id);
	}
	if (optionIds.size === 0) {
		return json({ error: 'Pick at least one valid option.' }, { status: 400 });
	}
	return [...optionIds];
}

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
		return json(
			{ error: 'This poll is closed.' },
			{ status: 409, headers: { 'x-reason': 'poll-closed' } }
		);
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body.' }, { status: 400 });
	}

	const geoError = geofenceGate(poll, body);
	if (geoError) return geoError;

	const resolved = resolveOptionIds(db, poll, pollId, body);
	if (resolved instanceof Response) return resolved;
	const optionIds = resolved;

	let displayName: string | null = null;
	if (poll.is_anonymous !== 1) {
		// When anonymous, refuse to persist a name even if the client sent one.
		displayName = sanitizeText(body.displayName, NAME_MAX) || null;
		if (!displayName) {
			return json({ error: 'This poll asks for your name.' }, { status: 400 });
		}
	}

	const deviceHash = deviceHashForPoll(locals.deviceId, pollId);
	castVote(db, { pollId, deviceHash, optionIds, displayName });
	// A recast may have abandoned a write-in this device previously added; clear
	// any write-in that no longer holds a vote so the option list stays honest.
	if (poll.allow_writein === 1) pruneOrphanWriteins(db, pollId);
	publishResults(db, poll);

	// optionIds echoes the recorded vote so the client can mark a freshly
	// created write-in option as "yours" without guessing its id.
	return json({ ok: true, optionIds, results: resultsPayload(db, poll) });
};
