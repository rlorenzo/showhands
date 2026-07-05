import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getPoll, verifyCreatorToken, closePoll, publishResults } from '$lib/server/polls';
import { normalizePollId } from '$lib/server/ids';

export const POST: RequestHandler = async ({ params, cookies }) => {
	const db = getDb();
	const pollId = normalizePollId(params.id);
	const poll = getPoll(db, pollId);
	if (!poll) {
		return json({ error: 'Poll not found.' }, { status: 404 });
	}
	const token = cookies.get(`soh_ct_${pollId}`);
	if (!verifyCreatorToken(poll, token)) {
		return json({ error: 'Only the poll creator can close it.' }, { status: 403 });
	}
	closePoll(db, pollId);
	const updated = getPoll(db, pollId);
	if (updated) publishResults(db, updated);
	return json({ ok: true });
};
