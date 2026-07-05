import { describe, it, expect, beforeEach } from 'vitest';
import { allow, resetAllLimits } from './ratelimit';

describe('rate limiter', () => {
	beforeEach(() => resetAllLimits());

	it('allows up to max hits then blocks', () => {
		const t = 1_000_000;
		for (let i = 0; i < 5; i++) expect(allow('k', 5, 60_000, t + i)).toBe(true);
		expect(allow('k', 5, 60_000, t + 10)).toBe(false);
	});

	it('slides the window', () => {
		const t = 1_000_000;
		for (let i = 0; i < 5; i++) expect(allow('k', 5, 60_000, t)).toBe(true);
		expect(allow('k', 5, 60_000, t + 30_000)).toBe(false);
		// original hits fall out of the window
		expect(allow('k', 5, 60_000, t + 60_001)).toBe(true);
	});

	it('tracks keys independently', () => {
		const t = 1_000_000;
		for (let i = 0; i < 5; i++) allow('a', 5, 60_000, t);
		expect(allow('a', 5, 60_000, t)).toBe(false);
		expect(allow('b', 5, 60_000, t)).toBe(true);
	});
});
