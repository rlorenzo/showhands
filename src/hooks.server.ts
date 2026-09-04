import type { Handle } from '@sveltejs/kit';
import { building, dev } from '$app/environment';
import { getDb } from '$lib/server/db';
import { sweep } from '$lib/server/polls';
import {
	ensureSecret,
	newRandomToken,
	signCookieValue,
	verifyCookieValue
} from '$lib/server/tokens';

const DEVICE_COOKIE = 'soh_device';

// Boot-time sweep + every 5 minutes. Guarded against dev-server HMR re-registration.
const g = globalThis as typeof globalThis & { __sohSweepStarted?: boolean };
if (!building && !g.__sohSweepStarted) {
	g.__sohSweepStarted = true;
	// Behind a reverse proxy the socket peer is always the proxy, so with
	// ADDRESS_HEADER unset every per-IP rate limit collapses into one shared
	// bucket (no throttling, and 30 bad codes lock everyone out). Refuse to
	// start silently misconfigured. SHOWHANDS_NO_PROXY=1 opts out when clients
	// really do connect directly (bare Docker port mapping, local preview).
	if (!dev && !process.env.ADDRESS_HEADER && process.env.SHOWHANDS_NO_PROXY !== '1') {
		throw new Error(
			'ADDRESS_HEADER is unset. Behind a reverse proxy set ADDRESS_HEADER=X-Forwarded-For and XFF_DEPTH=1; if clients connect directly set SHOWHANDS_NO_PROXY=1.'
		);
	}
	ensureSecret();
	try {
		sweep(getDb());
	} catch (err) {
		console.error('boot sweep failed', err);
	}
	const interval = setInterval(
		() => {
			try {
				sweep(getDb());
			} catch (err) {
				console.error('sweep failed', err);
			}
		},
		5 * 60 * 1000
	);
	// don't keep the process alive just for the sweep
	if (typeof interval === 'object' && 'unref' in interval) interval.unref();
}

export const handle: Handle = async ({ event, resolve }) => {
	let deviceId = verifyCookieValue(event.cookies.get(DEVICE_COOKIE));
	if (!deviceId) {
		deviceId = newRandomToken();
		event.cookies.set(DEVICE_COOKIE, signCookieValue(deviceId), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: event.url.protocol === 'https:',
			maxAge: 60 * 60 * 24 * 365
		});
	}
	event.locals.deviceId = deviceId;

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'no-referrer');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
	return response;
};
