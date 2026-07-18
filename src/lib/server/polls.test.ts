import { beforeEach, describe, expect, it } from 'vitest';

process.env.SHOWHANDS_SECRET = 'test-secret-for-unit-tests-only';

import type { Database } from 'better-sqlite3';
import { GRACE_SECONDS, WRITEIN_TOTAL_MAX } from '$lib/validation';
import { createDatabase } from './db';
import {
	addWriteInOption,
	type CreatePollInput,
	castVote,
	closePoll,
	createPoll,
	deleteOption,
	deletePoll,
	effectiveStatus,
	getCounts,
	getDeviceVote,
	getOptions,
	getPoll,
	getVoterNames,
	pruneOrphanWriteins,
	resultsPayload,
	sweep,
	toPollView,
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
		allowWritein: false,
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

	it('leaves write-ins off by default', () => {
		// allowWritein is an opt-in setting; a poll created without it stays off.
		const { id } = createPoll(db, makeInput({ allowWritein: false }), NOW);
		const poll = getPoll(db, id, NOW)!;
		expect(poll.allow_writein).toBe(0);
		expect(toPollView(poll, getOptions(db, id), NOW).allowWritein).toBe(false);
	});

	it('persists the write-in flag and exposes it on the poll view', () => {
		const { id } = createPoll(db, makeInput({ allowWritein: true }), NOW);
		const poll = getPoll(db, id, NOW)!;
		expect(poll.allow_writein).toBe(1);
		expect(toPollView(poll, getOptions(db, id), NOW).allowWritein).toBe(true);
	});

	it('appends a write-in option after the existing ones', () => {
		const { id } = createPoll(db, makeInput({ allowWritein: true }), NOW);
		const added = addWriteInOption(db, id, 'Sushi');
		expect('id' in added).toBe(true);
		expect(getOptions(db, id).map((o) => o.label)).toEqual(['Tacos', 'Ramen', 'Sushi']);
	});

	it('merges write-ins that differ only by case or Unicode form', () => {
		const { id } = createPoll(db, makeInput({ allowWritein: true }), NOW);
		const first = addWriteInOption(db, id, 'Sushi') as { id: number };
		expect(addWriteInOption(db, id, 'sushi')).toEqual({ id: first.id });
		expect(addWriteInOption(db, id, 'SUSHI')).toEqual({ id: first.id });
		// pre-seeded options merge too
		const [tacos] = getOptions(db, id);
		expect(addWriteInOption(db, id, 'TACOS')).toEqual({ id: tacos.id });
		expect(getOptions(db, id)).toHaveLength(3);
	});

	it('refuses write-ins past the per-poll option ceiling', () => {
		const { id } = createPoll(db, makeInput({ allowWritein: true }), NOW);
		for (let i = 0; i < WRITEIN_TOTAL_MAX - 2; i++) {
			expect(addWriteInOption(db, id, `Extra ${i}`)).toHaveProperty('id');
		}
		expect(getOptions(db, id)).toHaveLength(WRITEIN_TOTAL_MAX);
		expect(addWriteInOption(db, id, 'One too many')).toEqual({ full: true });
		// duplicates of existing labels still resolve when full
		expect(addWriteInOption(db, id, 'extra 0')).toHaveProperty('id');
	});

	it('includes the live option list in results payloads', () => {
		const { id } = createPoll(db, makeInput({ allowWritein: true }), NOW);
		const added = addWriteInOption(db, id, 'Sushi') as { id: number };
		castVote(db, { pollId: id, deviceHash: 'dev1', optionIds: [added.id], displayName: null }, NOW);
		const payload = resultsPayload(db, getPoll(db, id, NOW)!, NOW);
		expect(payload.options.map((o) => o.label)).toEqual(['Tacos', 'Ramen', 'Sushi']);
		expect(payload.counts?.[String(added.id)]).toBe(1);
	});

	it('prunes a write-in once its only voter recasts away from it', () => {
		const { id } = createPoll(db, makeInput({ allowWritein: true }), NOW);
		const [tacos] = getOptions(db, id);
		const sushi = addWriteInOption(db, id, 'Sushi') as { id: number };
		castVote(db, { pollId: id, deviceHash: 'dev1', optionIds: [sushi.id], displayName: null }, NOW);

		// dev1 changes their mind; Sushi held only their vote, so it's abandoned
		castVote(db, { pollId: id, deviceHash: 'dev1', optionIds: [tacos.id], displayName: null }, NOW);
		expect(pruneOrphanWriteins(db, id)).toBe(1);
		expect(getOptions(db, id).map((o) => o.label)).toEqual(['Tacos', 'Ramen']);
	});

	it('keeps an abandoned write-in that another voter still holds', () => {
		const { id } = createPoll(db, makeInput({ allowWritein: true }), NOW);
		const [tacos] = getOptions(db, id);
		const sushi = addWriteInOption(db, id, 'Sushi') as { id: number };
		castVote(db, { pollId: id, deviceHash: 'dev1', optionIds: [sushi.id], displayName: null }, NOW);
		castVote(db, { pollId: id, deviceHash: 'dev2', optionIds: [sushi.id], displayName: null }, NOW);

		// dev1 leaves Sushi, but dev2 still holds it — it survives
		castVote(db, { pollId: id, deviceHash: 'dev1', optionIds: [tacos.id], displayName: null }, NOW);
		expect(pruneOrphanWriteins(db, id)).toBe(0);
		expect(getOptions(db, id).map((o) => o.label)).toContain('Sushi');
	});

	it('never prunes seeded options, even with zero votes', () => {
		// The whole reason for the is_writein flag: a seeded option with no votes
		// must stay, or a poll could be pruned below its original set.
		const { id } = createPoll(db, makeInput({ options: ['A', 'B', 'C'] }), NOW);
		expect(pruneOrphanWriteins(db, id)).toBe(0);
		expect(getOptions(db, id)).toHaveLength(3);
	});

	it('leaves only the corrected label after a typo write-in is fixed', () => {
		const { id } = createPoll(db, makeInput({ allowWritein: true }), NOW);
		const typo = addWriteInOption(db, id, 'Piza') as { id: number };
		castVote(db, { pollId: id, deviceHash: 'dev1', optionIds: [typo.id], displayName: null }, NOW);
		// same voter re-writes the correct spelling (a distinct label) and recasts
		const fixed = addWriteInOption(db, id, 'Pizza') as { id: number };
		castVote(db, { pollId: id, deviceHash: 'dev1', optionIds: [fixed.id], displayName: null }, NOW);
		pruneOrphanWriteins(db, id);
		expect(getOptions(db, id).map((o) => o.label)).toEqual(['Tacos', 'Ramen', 'Pizza']);
	});

	it('deleteOption removes the option and cascades its votes', () => {
		const { id } = createPoll(db, makeInput({ options: ['Tacos', 'Ramen', 'Sushi'] }), NOW);
		const [tacos, , sushi] = getOptions(db, id);
		castVote(db, { pollId: id, deviceHash: 'dev1', optionIds: [sushi.id], displayName: null }, NOW);
		castVote(db, { pollId: id, deviceHash: 'dev2', optionIds: [tacos.id], displayName: null }, NOW);

		expect(deleteOption(db, id, sushi.id)).toBe('deleted');
		expect(getOptions(db, id).map((o) => o.label)).toEqual(['Tacos', 'Ramen']);
		// dev1's vote is gone with the option; only dev2 remains counted
		const { counts, total } = getCounts(db, id);
		expect(total).toBe(1);
		expect(counts[String(sushi.id)]).toBeUndefined();
		expect(getDeviceVote(db, id, 'dev1')).toBeNull();
	});

	it('deleteOption never drops a poll below the option minimum', () => {
		const { id } = createPoll(db, makeInput(), NOW);
		const [tacos] = getOptions(db, id);
		expect(deleteOption(db, id, tacos.id)).toBe('min_reached');
		expect(getOptions(db, id)).toHaveLength(2);
	});

	it('deleteOption reports unknown or foreign option ids as not found', () => {
		const { id } = createPoll(db, makeInput({ options: ['A', 'B', 'C'] }), NOW);
		const { id: other } = createPoll(db, makeInput({ options: ['X', 'Y', 'Z'] }), NOW);
		const [x] = getOptions(db, other);
		expect(deleteOption(db, id, 999_999)).toBe('not_found');
		expect(deleteOption(db, id, x.id)).toBe('not_found');
		expect(getOptions(db, other)).toHaveLength(3);
	});

	it('closePoll clamps expires_at so the grace countdown starts at close time', () => {
		const { id } = createPoll(db, makeInput({ expiresInSeconds: 7200 }), NOW);
		closePoll(db, id, NOW + 100);
		const poll = getPoll(db, id, NOW + 100)!;
		expect(poll.status).toBe('closed');
		expect(poll.expires_at).toBe(NOW + 100);
	});
});
