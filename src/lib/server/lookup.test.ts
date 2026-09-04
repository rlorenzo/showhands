import { beforeEach, describe, expect, it } from 'vitest';

process.env.SHOWHANDS_SECRET = 'test-secret-for-unit-tests-only-0';

import { createDatabase } from './db';
import { lookupPollOr404 } from './lookup';
import { createPoll } from './polls';
import { LIMITS, resetAllLimits } from './ratelimit';

describe('lookupPollOr404', () => {
	beforeEach(() => resetAllLimits());

	it('returns a live poll and 404s an unknown or malformed code', () => {
		const db = createDatabase(':memory:');
		const { id } = createPoll(db, {
			question: 'Q?',
			options: ['A', 'B'],
			isAnonymous: true,
			allowMulti: false,
			allowWritein: false,
			resultsVisibility: 'live',
			geofence: null,
			expiresInSeconds: 3600
		});
		expect(lookupPollOr404(db, id.toLowerCase(), '1.1.1.1').pollId).toBe(id);
		expect(() => lookupPollOr404(db, 'ZZZZ', '1.1.1.1')).toThrow(
			expect.objectContaining({ status: 404 })
		);
		expect(() => lookupPollOr404(db, 'not-a-code', '1.1.1.1')).toThrow(
			expect.objectContaining({ status: 404 })
		);
	});

	it('throttles repeated misses per IP', () => {
		const db = createDatabase(':memory:');
		for (let i = 0; i < LIMITS.lookupMiss.max; i++) {
			expect(() => lookupPollOr404(db, 'ZZZZ', '2.2.2.2')).toThrow(
				expect.objectContaining({ status: 404 })
			);
		}
		expect(() => lookupPollOr404(db, 'ZZZZ', '2.2.2.2')).toThrow(
			expect.objectContaining({ status: 429 })
		);
		expect(() => lookupPollOr404(db, 'ZZZZ', '3.3.3.3')).toThrow(
			expect.objectContaining({ status: 404 })
		);
	});
});
