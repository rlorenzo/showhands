import { afterEach, describe, expect, it, vi } from 'vitest';

async function freshTokens(secret: string) {
	vi.resetModules();
	process.env.SHOWHANDS_SECRET = secret;
	return import('./tokens');
}

describe('SHOWHANDS_SECRET', () => {
	const original = process.env.SHOWHANDS_SECRET;
	afterEach(() => {
		if (original === undefined) delete process.env.SHOWHANDS_SECRET;
		else process.env.SHOWHANDS_SECRET = original;
	});

	it('refuses a short secret instead of silently using a file-backed one', async () => {
		const tokens = await freshTokens('change-me');
		expect(() => tokens.ensureSecret()).toThrow(/SHOWHANDS_SECRET/);
	});

	it('accepts a 32-character secret', async () => {
		const tokens = await freshTokens('x'.repeat(32));
		expect(() => tokens.ensureSecret()).not.toThrow();
		expect(tokens.verifyCookieValue(tokens.signCookieValue('abc'))).toBe('abc');
	});
});
