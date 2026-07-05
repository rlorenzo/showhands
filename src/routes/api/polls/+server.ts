import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { createPoll } from '$lib/server/polls';
import { allow, LIMITS } from '$lib/server/ratelimit';
import { isValidLatLng } from '$lib/server/geo';
import {
	sanitizeText,
	QUESTION_MAX,
	OPTION_MAX,
	OPTIONS_MIN,
	OPTIONS_MAX,
	EXPIRY_CHOICES,
	DEFAULT_EXPIRY,
	isValidExpiry,
	isValidRadius
} from '$lib/validation';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress, url }) => {
	const ip = getClientAddress();
	if (!allow(`create:${ip}`, LIMITS.create.max, LIMITS.create.windowMs)) {
		return json({ error: 'Too many polls created. Try again later.' }, { status: 429 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body.' }, { status: 400 });
	}

	const question = sanitizeText(body.question, QUESTION_MAX);
	if (!question) {
		return json({ error: 'Question is required.' }, { status: 400 });
	}

	const rawOptions = Array.isArray(body.options) ? body.options : [];
	const options = rawOptions
		.map((o) => sanitizeText(o, OPTION_MAX))
		.filter((o) => o.length > 0)
		.slice(0, OPTIONS_MAX);
	if (options.length < OPTIONS_MIN) {
		return json({ error: `At least ${OPTIONS_MIN} options are required.` }, { status: 400 });
	}

	const expiry = isValidExpiry(body.expiry) ? body.expiry : DEFAULT_EXPIRY;

	let geofence: { lat: number; lng: number; radiusM: number } | null = null;
	if (body.geofence != null) {
		const g = body.geofence as Record<string, unknown>;
		if (!isValidLatLng(g.lat, g.lng) || !isValidRadius(g.radiusM)) {
			return json({ error: 'Invalid geofence.' }, { status: 400 });
		}
		geofence = { lat: g.lat as number, lng: g.lng as number, radiusM: g.radiusM as number };
	}

	const resultsVisibility = body.resultsVisibility === 'after_close' ? 'after_close' : 'live';

	const { id, creatorToken, deleteAfter } = createPoll(getDb(), {
		question,
		options,
		isAnonymous: body.isAnonymous !== false,
		allowMulti: body.allowMulti === true,
		resultsVisibility,
		geofence,
		expiresInSeconds: EXPIRY_CHOICES[expiry]
	});

	// Creator token cookie, scoped to this poll's page + API paths via a
	// poll-specific name (path stays '/' so both /p/ and /api/ see it).
	cookies.set(`soh_ct_${id}`, creatorToken, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: Math.max(60, deleteAfter - Math.floor(Date.now() / 1000))
	});

	return json({ id, url: `/p/${id}` }, { status: 201 });
};
