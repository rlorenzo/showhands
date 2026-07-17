import { describe, expect, it } from 'vitest';
import {
	EXPIRY_CHOICES,
	isValidExpiry,
	isValidRadius,
	QUESTION_MAX,
	sanitizeText
} from './validation';

describe('sanitizeText', () => {
	it('strips HTML tags', () => {
		expect(sanitizeText('<script>alert(1)</script>hello', 100)).toBe('alert(1)hello');
		expect(sanitizeText('a <b>bold</b> move', 100)).toBe('a bold move');
	});

	it('strips angle-bracket sequences and stray brackets', () => {
		// anything between < and > is treated as a tag and removed
		expect(sanitizeText('1 < 2 > 0', 100)).toBe('1 0');
		expect(sanitizeText('a < b', 100)).toBe('a b');
		expect(sanitizeText('a > b', 100)).toBe('a b');
	});

	it('strips control characters but keeps unicode', () => {
		expect(sanitizeText('caf\u0007\u0000\u009f\u007f\u00e9 \u2615', 100)).toBe('caf\u00e9 \u2615');
	});

	it('collapses whitespace and trims', () => {
		expect(sanitizeText('  a\n\n b\t c  ', 100)).toBe('a b c');
	});

	it('enforces max length', () => {
		expect(sanitizeText('x'.repeat(500), QUESTION_MAX)).toHaveLength(QUESTION_MAX);
	});

	it('returns empty string for non-strings', () => {
		expect(sanitizeText(42, 100)).toBe('');
		expect(sanitizeText(null, 100)).toBe('');
		expect(sanitizeText(undefined, 100)).toBe('');
		expect(sanitizeText({}, 100)).toBe('');
	});
});

describe('validators', () => {
	it('accepts only known expiry keys', () => {
		for (const key of Object.keys(EXPIRY_CHOICES)) expect(isValidExpiry(key)).toBe(true);
		expect(isValidExpiry('2h')).toBe(false);
		expect(isValidExpiry(3600)).toBe(false);
	});

	it('accepts only the fixed radius choices', () => {
		expect(isValidRadius(100)).toBe(true);
		expect(isValidRadius(250)).toBe(true);
		expect(isValidRadius(1000)).toBe(true);
		expect(isValidRadius(5000)).toBe(true);
		expect(isValidRadius(300)).toBe(false);
		expect(isValidRadius('100')).toBe(false);
	});
});
