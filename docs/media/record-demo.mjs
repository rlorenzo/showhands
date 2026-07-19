// Show of Hands — demo recorder.
//
// Drives the real production build (`npm run build && node build/index.js`)
// through the full loop on one recorded "phone" screen while background
// request-contexts cast real votes on a timer, so the results bars climb live
// over SSE — exactly like a real room. Produces the master webm + still PNGs.
//
// Usage (see build.sh for the full pipeline):
//   BASE_URL=http://localhost:5599 OUT_DIR=./out node docs/media/record-demo.mjs
//
// Run against a throwaway server started with SHOWHANDS_DISABLE_RATE_LIMITS=1
// (so the vote loop isn't throttled) and a scratch DATABASE_PATH.
import pw from '@playwright/test';

const { chromium, request } = pw;

const BASE = process.env.BASE_URL ?? 'http://localhost:5599';
const OUT = process.env.OUT_DIR ?? '.';
const VW = 600;
const VH = 1040;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Interleaved background-vote plan (excludes the creator's own Tacos vote).
// Final tally becomes Tacos 7, Ramen 5, Pizza 3, Salad 1 — Tacos clear winner,
// but Tacos and Ramen tie at 5–5 mid-climb first for a little tension.
const VOTE_PLAN = [
	'Ramen',
	'Tacos',
	'Pizza',
	'Ramen',
	'Tacos',
	'Salad',
	'Ramen',
	'Tacos',
	'Pizza',
	'Ramen',
	'Tacos',
	'Ramen',
	'Tacos',
	'Pizza',
	'Tacos'
];
const VOTE_SPACING_MS = 430;

async function main() {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: VW, height: VH },
		deviceScaleFactor: 2,
		colorScheme: 'light',
		reducedMotion: 'no-preference',
		recordVideo: { dir: `${OUT}/rec-raw`, size: { width: VW, height: VH } }
	});
	const page = await context.newPage();

	// Presentation-only: hide the footer (external sponsor iframe) so the
	// marketing capture is clean. Does not alter the app itself.
	await context.addInitScript(() => {
		const apply = () => {
			if (document.getElementById('demo-hide')) return;
			const s = document.createElement('style');
			s.id = 'demo-hide';
			s.textContent = '.site-footer{display:none!important}';
			(document.head ?? document.documentElement).appendChild(s);
		};
		if (document.head) apply();
		else document.addEventListener('DOMContentLoaded', apply);
	});

	const shot = (name) => page.screenshot({ path: `${OUT}/media/still-${name}.png` });

	// ---- Beat A: create -------------------------------------------------
	await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
	await page.addStyleTag({ content: '.site-footer{display:none!important}' });
	await page.waitForSelector('h1');
	await sleep(900);

	const opt = (n) => page.getByRole('textbox', { name: `Option ${n}`, exact: true });
	await page.getByLabel('Poll question').pressSequentially('Where should we eat?', { delay: 55 });
	await sleep(250);
	await opt(1).pressSequentially('Tacos', { delay: 55 });
	await opt(2).pressSequentially('Ramen', { delay: 55 });
	await page.getByRole('button', { name: '+ Add option' }).click();
	await opt(3).pressSequentially('Pizza', { delay: 55 });
	await page.getByRole('button', { name: '+ Add option' }).click();
	await opt(4).pressSequentially('Salad', { delay: 55 });
	await sleep(500);
	await shot('create');
	await sleep(400);
	await page.getByRole('button', { name: 'Create poll' }).click();

	// ---- Beat B: share (QR + 4-letter code) -----------------------------
	await page.waitForURL(/\/p\/[A-Z0-9]{4}/, { timeout: 10_000 });
	const pollId = page.url().match(/\/p\/([A-Z0-9]{4})/)[1];
	console.log('poll code:', pollId);
	await page.waitForSelector('img.qr');
	await sleep(300);
	await shot('share');

	// Resolve option label -> id from the live results payload.
	const rc = await request.newContext({ baseURL: BASE });
	const results = await (await rc.get(`/api/polls/${pollId}/results`)).json();
	const idByLabel = Object.fromEntries(results.options.map((o) => [o.label, o.id]));
	await rc.dispose();

	// Kick off background voters (not awaited — they run on wall-clock alongside
	// the choreography below and land live over SSE).
	const voting = runVoters(pollId, idByLabel);
	await sleep(2600); // hold on the hero QR/code moment

	// ---- Beat C: vote + watch it land live ------------------------------
	await page.getByRole('button', { name: 'Hide sharing' }).click();
	await sleep(500);
	await page.getByRole('button', { name: 'Tacos' }).click();
	await sleep(350);
	await page.getByRole('button', { name: 'Vote', exact: true }).click();
	await page.waitForSelector('.results-wrap');
	await sleep(2600);
	await shot('results');
	await sleep(2600);

	// ---- Beat D: winner emerges -----------------------------------------
	await voting; // ensure every background vote has landed
	await sleep(400);
	await page.getByRole('button', { name: 'Close now' }).click();
	await sleep(500);
	await page.getByRole('button', { name: 'Close poll' }).click();
	await page.waitForSelector('li.winner');
	await sleep(600);
	await shot('winner');
	await sleep(3200); // hold on the payoff

	await page.close();
	const rawPath = await page.video().path();
	await context.close();
	await browser.close();
	console.log('raw video:', rawPath);
}

async function runVoters(pollId, idByLabel) {
	await sleep(800); // let the share beat settle before the first vote
	for (const label of VOTE_PLAN) {
		castOne(pollId, idByLabel[label]); // fire-and-forget; keeps cadence tight
		await sleep(VOTE_SPACING_MS);
	}
	await sleep(600);
}

async function castOne(pollId, optionId) {
	// Fresh isolated context => fresh signed device cookie => a distinct voter.
	const ctx = await request.newContext({ baseURL: BASE });
	try {
		await ctx.post(`/api/polls/${pollId}/vote`, { data: { optionIds: [optionId] } });
	} catch (err) {
		console.error('vote failed', err.message);
	} finally {
		await ctx.dispose();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
