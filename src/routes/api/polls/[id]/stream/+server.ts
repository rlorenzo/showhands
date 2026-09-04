import { type ResultsPayload, subscribe } from '$lib/server/broadcast';
import { getDb } from '$lib/server/db';
import { lookupPollOr404 } from '$lib/server/lookup';
import { resultsPayload } from '$lib/server/polls';
import type { RequestHandler } from './$types';

const KEEPALIVE_MS = 25_000; // iOS Safari reaps quiet SSE connections; comment every 25s

// Each open stream holds a listener and a timer; cap them per IP so one client
// can't exhaust file descriptors. Generous: a shared NAT is many phones.
const MAX_STREAMS_PER_IP = 20;
const openStreams = new Map<string, number>();

export const GET: RequestHandler = async ({ params, getClientAddress }) => {
	const ip = getClientAddress();
	const db = getDb();
	const { pollId, poll } = lookupPollOr404(db, params.id, ip);

	const open = openStreams.get(ip) ?? 0;
	if (open >= MAX_STREAMS_PER_IP) {
		return new Response('too many open streams', { status: 429 });
	}
	openStreams.set(ip, open + 1);

	const encoder = new TextEncoder();
	let unsubscribe: (() => void) | null = null;
	let keepalive: ReturnType<typeof setInterval> | null = null;
	let released = false;
	const cleanup = () => {
		if (released) return;
		released = true;
		if (keepalive) clearInterval(keepalive);
		keepalive = null;
		unsubscribe?.();
		unsubscribe = null;
		const left = (openStreams.get(ip) ?? 1) - 1;
		if (left <= 0) openStreams.delete(ip);
		else openStreams.set(ip, left);
	};

	const stream = new ReadableStream({
		start(controller) {
			const send = (payload: ResultsPayload) => {
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
				} catch {
					cleanup();
				}
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
		cancel: cleanup
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
