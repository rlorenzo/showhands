import { type ResultsPayload, subscribe } from '$lib/server/broadcast';
import { getDb } from '$lib/server/db';
import { normalizePollId } from '$lib/server/ids';
import { getPoll, resultsPayload } from '$lib/server/polls';
import type { RequestHandler } from './$types';

const KEEPALIVE_MS = 25_000; // iOS Safari reaps quiet SSE connections; comment every 25s

export const GET: RequestHandler = async ({ params }) => {
	const db = getDb();
	const pollId = normalizePollId(params.id);
	const poll = getPoll(db, pollId);
	if (!poll) {
		return new Response('not found', { status: 404 });
	}

	const encoder = new TextEncoder();
	let unsubscribe: (() => void) | null = null;
	let keepalive: ReturnType<typeof setInterval> | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const send = (payload: ResultsPayload) => {
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
				} catch {
					cleanup();
				}
			};
			const cleanup = () => {
				if (keepalive) clearInterval(keepalive);
				keepalive = null;
				unsubscribe?.();
				unsubscribe = null;
			};

			send(resultsPayload(db, poll));
			unsubscribe = subscribe(pollId, send);
			keepalive = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(`: keepalive\n\n`));
				} catch {
					cleanup();
				}
			}, KEEPALIVE_MS);
		},
		cancel() {
			if (keepalive) clearInterval(keepalive);
			keepalive = null;
			unsubscribe?.();
			unsubscribe = null;
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-store',
			connection: 'keep-alive',
			'x-accel-buffering': 'no'
		}
	});
};
