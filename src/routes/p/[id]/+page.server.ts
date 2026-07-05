import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { isValidPollIdShape, normalizePollId } from '$lib/server/ids';
import {
	getDeviceVote,
	getOptions,
	getPoll,
	nowSeconds,
	resultsPayload,
	toPollView,
	verifyCreatorToken
} from '$lib/server/polls';
import { allow, LIMITS } from '$lib/server/ratelimit';
import { deviceHashForPoll } from '$lib/server/tokens';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, cookies, getClientAddress }) => {
	const pollId = normalizePollId(params.id);
	const db = getDb();
	const poll = isValidPollIdShape(pollId) ? getPoll(db, pollId) : null;

	if (!poll) {
		// Throttle unknown-code lookups so the 920k-combination ID space
		// can't be enumerated. Missing and expired polls 404 identically.
		if (!allow(`miss:${getClientAddress()}`, LIMITS.lookupMiss.max, LIMITS.lookupMiss.windowMs)) {
			error(429, 'Too many lookups. Slow down.');
		}
		error(404, 'Poll not found');
	}

	const now = nowSeconds();
	const options = getOptions(db, pollId);
	const view = toPollView(poll, options, now);
	const deviceHash = deviceHashForPoll(locals.deviceId, pollId);
	const myVote = getDeviceVote(db, pollId, deviceHash);
	const isCreator = verifyCreatorToken(poll, cookies.get(`soh_ct_${pollId}`));

	return {
		poll: view,
		results: resultsPayload(db, poll, now),
		myVote,
		isCreator,
		serverNow: now
	};
};
