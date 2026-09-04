import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let secret: Buffer | null = null;
const MIN_SECRET_CHARS = 32;

/**
 * HMAC key for device hashes, creator tokens, and cookie signatures.
 * Uses SHOWHANDS_SECRET when set; otherwise generates one and persists it
 * next to the database so restarts don't invalidate every cookie. A set but
 * too-short secret is an error, not a silent fallback: the operator believes
 * they configured it.
 */
function getSecret(): Buffer {
	if (secret) return secret;
	const env = process.env.SHOWHANDS_SECRET;
	if (env !== undefined) {
		if (env.length < MIN_SECRET_CHARS) {
			throw new Error(
				`SHOWHANDS_SECRET must be at least ${MIN_SECRET_CHARS} characters (got ${env.length}). Generate one with: openssl rand -hex 32`
			);
		}
		secret = Buffer.from(env, 'utf8');
		return secret;
	}
	const dir = process.env.DATABASE_PATH
		? path.dirname(process.env.DATABASE_PATH)
		: path.join(process.cwd(), 'data');
	const file = path.join(dir, 'secret.key');
	try {
		secret = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'hex');
		if (secret.length >= 16) return secret;
	} catch {
		// fall through and generate
	}
	secret = randomBytes(32);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(file, secret.toString('hex'), { mode: 0o600 });
	return secret;
}

/** Load (and validate) the secret at boot so misconfiguration fails at startup, not on the first request. */
export function ensureSecret(): void {
	getSecret();
}

function hmacHex(value: string): string {
	return createHmac('sha256', getSecret()).update(value).digest('hex');
}

export function newRandomToken(): string {
	return randomBytes(24).toString('hex');
}

/** Vote uniqueness key. Salted per poll so devices cannot be correlated across polls. */
export function deviceHashForPoll(deviceId: string, pollId: string): string {
	return hmacHex(`device:${pollId}:${deviceId}`);
}

export function creatorTokenHash(token: string): string {
	return hmacHex(`creator:${token}`);
}

export function safeEqualHex(a: string, b: string): boolean {
	const ba = Buffer.from(a, 'hex');
	const bb = Buffer.from(b, 'hex');
	if (ba.length !== bb.length || ba.length === 0) return false;
	return timingSafeEqual(ba, bb);
}

/** Signed cookie value: `<id>.<sig>`. Forged device IDs are rejected. */
export function signCookieValue(id: string): string {
	return `${id}.${hmacHex(`cookie:${id}`)}`;
}

export function verifyCookieValue(value: string | undefined): string | null {
	if (!value) return null;
	const dot = value.lastIndexOf('.');
	if (dot <= 0) return null;
	const id = value.slice(0, dot);
	const sig = value.slice(dot + 1);
	if (!/^[a-f0-9]{64}$/.test(sig)) return null;
	if (!safeEqualHex(sig, hmacHex(`cookie:${id}`))) return null;
	return id;
}
