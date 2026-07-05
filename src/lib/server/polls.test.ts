import { beforeEach, describe, expect, it } from 'vitest';

process.env.SHOWHANDS_SECRET = 'test-secret-for-unit-tests-only';

import type { Database } from 'better-sqlite3';
import { GRACE_SECONDS } from '$lib/validation';
import { createDatabase } from './db';
import {
	type CreatePollInput,
	castVote,
	closePoll,
	createPoll,
	deletePoll,
	effectiveStatus,
	getCounts,
	getDeviceVote,
	getOptions,
	getPoll,
	getVoterNames,
	resultsPayload,
	sweep,
	updateRadius,
	verifyCreatorToken
} from './polls';

const NOW = 1_800_000_000;

function makeInput(overrides: Partial<CreatePollInput> = {}): CreatePollInput {
	return {
		question: 'Where should we eat?',
		options: ['Tacos', 'Ramen'],
		isAnonymous: true,
		allowMulti: false,
		resultsVisibility: 'live',
		geofence: null,
		expiresInSeconds: 3600,
		...overrides
	};
}

describe('polls', () => {
	let db: Database;

	beforeEach(() => {
		db = createDatabase(':memory:');
	});

	it('creates a poll with options in order and a verifiable creator token', () => {
		const { id, creatorToken } = createPoll(db, makeInput(), NOW);
		const poll = getPoll(db, id, NOW)!;
		expect(poll.question).toBe('Where should we eat?');
		expect(poll.expires_at).toBe(NOW + 3600);
		expect(poll.delete_after).toBe(NOW + 3600 + GRACE_SECONDS);
		expect(getOptions(db, id).map((o) => o.label)).toEqual(['Tacos', 'Ramen']);
		expect(verifyCreatorToken(poll, creatorToken)).toBe(true);
		expect(verifyCreatorToken(poll, 'wrong-token')).toBe(false);
		expect(verifyCreatorToken(poll, null)).toBe(false);
	});

	it('rounds stored geofence coordinates to 4 decimal places', () => {
		const { id } = createPoll(
			db,
			makeInput({ geofence: { lat: 37.779256789, lng: -122.41923456, radiusM: 250 } }),
			NOW
		);
		const poll = getPoll(db, id, NOW)!;
		expect(poll.geofence_lat).toBe(37.7793);
		expect(poll.geofence_lng).toBe(-122.4192);
		expect(poll.geofence_radius_m).toBe(250);
	});

	it('replaces a device vote instead of duplicating it', () => {
		const { id } = createPoll(db, makeInput(), NOW);
		const [a, b] = getOptions(db, id);
		castVote(db, { pollId: id, deviceHash: 'dev1', optionIds: [a.id], displayName: null }, NOW);
		castVote(db, { pollId: id, deviceHash: 'dev1', optionIds: [b.id], displayName: null }, NOW);
		const { counts, total } = getCounts(db, id);
		expect(total).toBe(1);
		expect(counts[String(a.id)]).toBeUndefined();
		expect(counts[String(b.id)]).toBe(1);
		expect(getDeviceVote(db, id, 'dev1')!.optionIds).toEqual([b.id]);
	});

	it('counts distinct voters with multi-select votes', () => {
		const { id } = createPoll(db, makeInput({ allowMulti: true }), NOW);
		const [a, b] = getOptions(db, id);
		castVote(
			db,
			{ pollId: id, deviceHash: 'dev1', optionIds: [a.id, b.id], displayName: null },
			NOW
		);
		castVote(db, { pollId: id, deviceHash: 'dev2', optionIds: [a.id], displayName: null }, NOW);
		const { counts, total } = getCounts(db, id);
		expect(total).toBe(2);
		expect(counts[String(a.id)]).toBe(2);
		expect(counts[String(b.id)]).toBe(1);
	});

	it('lists voter names only for named polls', () => {
		const { id } = createPoll(db, makeInput({ isAnonymous: false }), NOW);
		const [a] = getOptions(db, id);
		castVote(db, { pollId: id, deviceHash: 'dev1', optionIds: [a.id], displayName: 'Zoe' }, NOW);
		castVote(db, { pollId: id, deviceHash: 'dev2', optionIds: [a.id], displayName: 'ana' }, NOW);
		expect(getVoterNames(db, id)).toEqual(['ana', 'Zoe']); // case-insensitive sort
	});

	it('treats polls past expires_at as closed even before the sweep runs', () => {
		const { id } = createPoll(db, makeInput({ expiresInSeconds: 3600 }), NOW);
		const poll = getPoll(db, id, NOW)!;
		expect(effectiveStatus(poll, NOW)).toBe('open');
		expect(effectiveStatus(poll, NOW + 3601)).toBe('closed');
	});

	it('hides counts until close when results_visibility is after_close', () => {
		const { id } = createPoll(db, makeInput({ resultsVisibility: 'after_close' }), NOW);
		const [a] = getOptions(db, id);
		castVote(db, { pollId: id, deviceHash: 'dev1', optionIds: [a.id], displayName: null }, NOW);
		let payload = resultsPayload(db, getPoll(db, id, NOW)!, NOW);
		expect(payload.counts).toBeNull();
		expect(payload.total).toBe(1);
		closePoll(db, id, NOW);
		payload = resultsPayload(db, getPoll(db, id, NOW)!, NOW);
		expect(payload.counts).not.toBeNull();
		expect(payload.status).toBe('closed');
	});

	it('sweep closes expired polls and hard-deletes past the grace window', () => {
		const { id: fresh } = createPoll(db, makeInput({ expiresInSeconds: 7200 }), NOW);
		const { id: expiring } = createPoll(db, makeInput({ expiresInSeconds: 60 }), NOW);
		const [opt] = getOptions(db, expiring);
		castVote(
			db,
			{ pollId: expiring, deviceHash: 'd', optionIds: [opt.id], displayName: null },
			NOW
		);

		let r = sweep(db, NOW + 120);
		expect(r.closed).toBe(1);
		expect(r.deleted).toBe(0);
		expect(getPoll(db, expiring, NOW + 120)!.status).toBe('closed');
		expect(getPoll(db, fresh, NOW + 120)!.status).toBe('open');

		// past delete_after: gone, votes and options cascade
		r = sweep(db, NOW + 60 + GRACE_SECONDS + 1);
		expect(r.deleted).toBeGreaterThanOrEqual(1);
		expect(getPoll(db, expiring, NOW + 60 + GRACE_SECONDS + 1)).toBeNull();
		expect(db.prepare('SELECT COUNT(*) AS n FROM votes WHERE poll_id = ?').get(expiring)).toEqual({
			n: 0
		});
		expect(db.prepare('SELECT COUNT(*) AS n FROM options WHERE poll_id = ?').get(expiring)).toEqual(
			{
				n: 0
			}
		);
	});

	it('getPoll hides rows past delete_after even if the sweep has not run', () => {
		const { id } = createPoll(db, makeInput({ expiresInSeconds: 60 }), NOW);
		expect(getPoll(db, id, NOW + 61 + GRACE_SECONDS)).toBeNull();
	});

	it('deletePoll cascades to options and votes', () => {
		const { id } = createPoll(db, makeInput(), NOW);
		const [a] = getOptions(db, id);
		castVote(db, { pollId: id, deviceHash: 'dev1', optionIds: [a.id], displayName: null }, NOW);
		deletePoll(db, id);
		expect(getPoll(db, id, NOW)).toBeNull();
		expect(db.prepare('SELECT COUNT(*) AS n FROM votes').get()).toEqual({ n: 0 });
		expect(db.prepare('SELECT COUNT(*) AS n FROM options').get()).toEqual({ n: 0 });
	});

	it('updateRadius only applies to geofenced polls', () => {
		const { id: plain } = createPoll(db, makeInput(), NOW);
		updateRadius(db, plain, 1000);
		expect(getPoll(db, plain, NOW)!.geofence_radius_m).toBeNull();

		const { id: fenced } = createPoll(
			db,
			makeInput({ geofence: { lat: 37.7, lng: -122.4, radiusM: 100 } }),
			NOW
		);
		updateRadius(db, fenced, 1000);
		expect(getPoll(db, fenced, NOW)!.geofence_radius_m).toBe(1000);
	});

	it('closePoll clamps expires_at so the grace countdown starts at close time', () => {
		const { id } = createPoll(db, makeInput({ expiresInSeconds: 7200 }), NOW);
		closePoll(db, id, NOW + 100);
		const poll = getPoll(db, id, NOW + 100)!;
		expect(poll.status).toBe('closed');
		expect(poll.expires_at).toBe(NOW + 100);
	});
});
