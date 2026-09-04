import { getDb } from '$lib/server/db';
import { lookupPollOr404 } from '$lib/server/lookup';
import {
	getDeviceVote,
	getOptions,
	nowSeconds,
	resultsPayload,
	toPollView,
	verifyCreatorToken
} from '$lib/server/polls';
import { deviceHashForPoll } from '$lib/server/tokens';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, cookies, getClientAddress }) => {
	const db = getDb();
	const { pollId, poll } = lookupPollOr404(db, params.id, getClientAddress());

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
