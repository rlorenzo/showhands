import { json } from '@sveltejs/kit';
import { requireCreatorPoll } from '$lib/server/creator';
import { deleteOption, effectiveStatus, publishResults, resultsPayload } from '$lib/server/polls';
import { OPTIONS_MIN } from '$lib/validation';
import type { RequestHandler } from './$types';

/** Creator moderation: remove a single option and its votes (e.g. an
 * offensive write-in) without nuking the whole poll. */
export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const ctx = requireCreatorPoll(params.id, cookies, 'remove options');
	if (ctx instanceof Response) return ctx;

	if (effectiveStatus(ctx.poll) === 'closed') {
		return json({ error: 'This poll is closed; the tally is final.' }, { status: 409 });
	}

	const optionId = Number(params.optionId);
	if (!Number.isInteger(optionId)) {
		return json({ error: 'Invalid option.' }, { status: 400 });
	}

	const outcome = deleteOption(ctx.db, ctx.pollId, optionId);
	if (outcome === 'not_found') {
		return json({ error: 'Option not found.' }, { status: 404 });
	}
	if (outcome === 'min_reached') {
		return json({ error: `A poll needs at least ${OPTIONS_MIN} options.` }, { status: 409 });
	}

	publishResults(ctx.db, ctx.poll);
	return json({ ok: true, results: resultsPayload(ctx.db, ctx.poll) });
};
