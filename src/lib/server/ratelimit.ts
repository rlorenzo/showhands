/**
 * In-memory sliding-window rate limiter. Single-process by design
 * (the app deploys as one Node server). State is lost on restart,
 * which is acceptable for abuse throttling.
 */

interface Window {
	timestamps: number[];
}

const buckets = new Map<string, Window>();

let lastPrune = 0;
const PRUNE_INTERVAL_MS = 60_000;
const MAX_WINDOW_MS = 60 * 60 * 1000;

function pruneAll(now: number) {
	if (now - lastPrune < PRUNE_INTERVAL_MS) return;
	lastPrune = now;
	for (const [key, win] of buckets) {
		win.timestamps = win.timestamps.filter((t) => now - t < MAX_WINDOW_MS);
		if (win.timestamps.length === 0) buckets.delete(key);
	}
}

/** Record a hit and return true if the caller is within the limit. */
export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
	// Escape hatch for automated tests; never set in production.
	if (process.env.SHOWHANDS_DISABLE_RATE_LIMITS === '1') return true;
	pruneAll(now);
	let win = buckets.get(key);
	if (!win) {
		win = { timestamps: [] };
		buckets.set(key, win);
	}
	win.timestamps = win.timestamps.filter((t) => now - t < windowMs);
	if (win.timestamps.length >= max) return false;
	win.timestamps.push(now);
	return true;
}

export function resetAllLimits() {
	buckets.clear();
}

export const LIMITS = {
	/** poll creations per IP per hour */
	create: { max: 10, windowMs: 60 * 60 * 1000 },
	/** votes per IP per hour (generous: many phones share one carrier NAT) */
	votePerIp: { max: 100, windowMs: 60 * 60 * 1000 },
	/** votes per IP per poll per hour */
	votePerIpPoll: { max: 20, windowMs: 60 * 60 * 1000 },
	/** unknown-code lookups per IP per 10 minutes (anti-enumeration) */
	lookupMiss: { max: 30, windowMs: 10 * 60 * 1000 }
} as const;
