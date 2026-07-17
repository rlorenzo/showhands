import { randomInt } from 'node:crypto';

// Unambiguous alphabet: no 0/O, no 1/I/L. 31 characters.
export const POLL_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const POLL_ID_LENGTH = 4;

export function generatePollId(): string {
	let id = '';
	for (let i = 0; i < POLL_ID_LENGTH; i++) {
		id += POLL_ID_ALPHABET[randomInt(POLL_ID_ALPHABET.length)];
	}
	return id;
}

/**
 * Normalize user-typed codes. Ambiguous characters (0/O/1/I/L) are excluded
 * from the alphabet itself, so normalization is just trim + uppercase.
 */
export function normalizePollId(raw: string): string {
	return raw.trim().toUpperCase();
}

export function isValidPollIdShape(id: string): boolean {
	if (id.length !== POLL_ID_LENGTH) return false;
	for (const ch of id) {
		if (!POLL_ID_ALPHABET.includes(ch)) return false;
	}
	return true;
}
