/** In-process pub/sub for live poll results (SSE fan-out). */

export interface ResultsPayload {
	status: 'open' | 'closed';
	total: number;
	counts: Record<string, number> | null; // null while results are hidden
	voters: string[] | null; // display names, named polls only
	closesAt: number; // unix seconds
	serverNow: number; // unix seconds
}

type Listener = (payload: ResultsPayload) => void;

const channels = new Map<string, Set<Listener>>();

export function subscribe(pollId: string, listener: Listener): () => void {
	let set = channels.get(pollId);
	if (!set) {
		set = new Set();
		channels.set(pollId, set);
	}
	set.add(listener);
	return () => {
		set.delete(listener);
		if (set.size === 0) channels.delete(pollId);
	};
}

export function publish(pollId: string, payload: ResultsPayload) {
	const set = channels.get(pollId);
	if (!set) return;
	for (const listener of set) {
		try {
			listener(payload);
		} catch {
			// a broken stream must not affect other subscribers
		}
	}
}

/** Drop all listeners for a poll (poll deleted). */
export function closeChannel(pollId: string) {
	channels.delete(pollId);
}
