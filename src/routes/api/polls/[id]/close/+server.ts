import { json } from '@sveltejs/kit';
import { requireCreatorPoll } from '$lib/server/creator';
import { closePoll, getPoll, publishResults } from '$lib/server/polls';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, cookies }) => {
	const ctx = requireCreatorPoll(params.id, cookies, 'close it');
	if (ctx instanceof Response) return ctx;

	closePoll(ctx.db, ctx.pollId);
	const updated = getPoll(ctx.db, ctx.pollId);
	if (updated) publishResults(ctx.db, updated);
	return json({ ok: true });
};
