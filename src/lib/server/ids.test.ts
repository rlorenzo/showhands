import { describe, expect, it } from 'vitest';
import {
	generatePollId,
	isValidPollIdShape,
	normalizePollId,
	POLL_ID_ALPHABET,
	POLL_ID_LENGTH
} from './ids';

describe('poll IDs', () => {
	it('uses a 31-character alphabet with no ambiguous characters', () => {
		expect(POLL_ID_ALPHABET).toHaveLength(31);
		for (const ambiguous of ['0', 'O', '1', 'I', 'L']) {
			expect(POLL_ID_ALPHABET).not.toContain(ambiguous);
		}
		expect(new Set(POLL_ID_ALPHABET).size).toBe(31);
	});

	it('generates 4-character codes from the alphabet', () => {
		for (let i = 0; i < 200; i++) {
			const id = generatePollId();
			expect(id).toHaveLength(POLL_ID_LENGTH);
			expect(isValidPollIdShape(id)).toBe(true);
		}
	});

	it('generates varied codes', () => {
		const ids = new Set(Array.from({ length: 100 }, generatePollId));
		expect(ids.size).toBeGreaterThan(90);
	});

	it('normalizes user input', () => {
		expect(normalizePollId(' abcd ')).toBe('ABCD');
	});

	it('rejects malformed codes', () => {
		expect(isValidPollIdShape('ABC')).toBe(false);
		expect(isValidPollIdShape('ABCDE')).toBe(false);
		expect(isValidPollIdShape('AB0D')).toBe(false); // 0 not in alphabet
		expect(isValidPollIdShape('ABID')).toBe(false); // I not in alphabet
		expect(isValidPollIdShape('ab2d')).toBe(false); // lowercase
	});
});
