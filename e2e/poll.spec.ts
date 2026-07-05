import { test, expect, type Browser, type Page } from '@playwright/test';

async function createPoll(
	page: Page,
	opts: {
		question: string;
		options: string[];
		named?: boolean;
		multi?: boolean;
		afterClose?: boolean;
	}
): Promise<string> {
	await page.goto('/');
	await page.getByLabel('Poll question').fill(opts.question);
	for (let i = 0; i < opts.options.length; i++) {
		if (i >= 2) await page.getByRole('button', { name: '+ Add option' }).click();
		await page.getByRole('textbox', { name: `Option ${i + 1}`, exact: true }).fill(opts.options[i]);
	}
	if (opts.named || opts.multi || opts.afterClose) {
		await page.getByRole('button', { name: /Settings/ }).click();
		if (opts.named) await page.getByLabel(/Anonymous votes/).uncheck();
		if (opts.multi) await page.getByLabel(/Multiple selections/).check();
		if (opts.afterClose) await page.getByLabel(/Results/).selectOption('after_close');
	}
	await page.getByRole('button', { name: 'Create poll' }).click();
	await page.waitForURL(/\/p\/[A-Z2-9]{4}/);
	const id = page.url().match(/\/p\/([A-Z2-9]{4})/)![1];
	return id;
}

async function newVoter(browser: Browser, pollId: string): Promise<Page> {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(`/p/${pollId}`);
	return page;
}

test.describe('Flow A: create', () => {
	test('creates a poll and shows share panel with QR and code', async ({ page }) => {
		const id = await createPoll(page, {
			question: 'Where should we eat?',
			options: ['Tacos', 'Ramen', 'Pizza']
		});
		await expect(page.getByRole('heading', { name: 'Where should we eat?' })).toBeVisible();
		// creator lands with share panel open (?new=1)
		await expect(page.getByLabel('Poll code')).toHaveText(id);
		await expect(page.getByAltText('QR code linking to this poll')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
		// creator controls present
		await expect(page.getByRole('button', { name: 'Close now' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
	});

	test('validates that two options are required', async ({ page }) => {
		await page.goto('/');
		await page.getByLabel('Poll question').fill('Incomplete poll');
		await page.getByRole('textbox', { name: 'Option 1', exact: true }).fill('Only one');
		await expect(page.getByRole('button', { name: 'Create poll' })).toBeDisabled();
	});
});

test.describe('Flow B: vote', () => {
	test('voter votes, sees live results; revote replaces, not duplicates', async ({
		page,
		browser
	}) => {
		const id = await createPoll(page, { question: 'Best day?', options: ['Fri', 'Sat'] });

		const voter = await newVoter(browser, id);
		await voter.getByRole('radio', { name: 'Fri' }).click();
		await voter.getByRole('button', { name: 'Vote', exact: true }).click();
		await expect(voter.getByText('1 vote', { exact: false })).toBeVisible();
		await expect(voter.getByText('✓ you')).toBeVisible();

		// change vote — total stays 1
		await voter.getByRole('button', { name: 'Change my vote' }).click();
		await voter.getByRole('radio', { name: 'Sat' }).click();
		await voter.getByRole('button', { name: 'Update vote' }).click();
		await expect(voter.getByText(/^1 vote$/)).toBeVisible();

		await voter.context().close();
	});

	test('second device vote appears live for a watcher in under 2s', async ({ page, browser }) => {
		const id = await createPoll(page, { question: 'Realtime?', options: ['Yes', 'No'] });

		// watcher votes first so they see the results view
		const watcher = await newVoter(browser, id);
		await watcher.getByRole('radio', { name: 'Yes' }).click();
		await watcher.getByRole('button', { name: 'Vote', exact: true }).click();
		await expect(watcher.getByText(/^1 vote$/)).toBeVisible();

		const voter2 = await newVoter(browser, id);
		await voter2.getByRole('radio', { name: 'No' }).click();
		await voter2.getByRole('button', { name: 'Vote', exact: true }).click();

		// watcher's page must update via SSE without reload
		await expect(watcher.getByText(/^2 votes$/)).toBeVisible({ timeout: 2000 });

		await watcher.context().close();
		await voter2.context().close();
	});

	test('named poll requires a name and lists voters', async ({ page, browser }) => {
		const id = await createPoll(page, {
			question: 'Named poll',
			options: ['A', 'B'],
			named: true
		});

		const voter = await newVoter(browser, id);
		await voter.getByRole('radio', { name: 'A', exact: true }).click();
		await voter.getByRole('button', { name: 'Vote', exact: true }).click();
		await expect(voter.getByText('Enter your name to vote')).toBeVisible();

		await voter.getByLabel('Your display name').fill('Rex');
		await voter.getByRole('button', { name: 'Vote', exact: true }).click();
		await expect(voter.getByText('Who voted')).toBeVisible();
		await expect(voter.getByText('Rex')).toBeVisible();

		await voter.context().close();
	});

	test('multi-select allows several options from one voter', async ({ page, browser }) => {
		const id = await createPoll(page, {
			question: 'Toppings?',
			options: ['Cheese', 'Basil'],
			multi: true
		});

		const voter = await newVoter(browser, id);
		await voter.getByRole('checkbox', { name: 'Cheese' }).click();
		await voter.getByRole('checkbox', { name: 'Basil' }).click();
		await voter.getByRole('button', { name: 'Vote', exact: true }).click();
		// one voter, two option rows counted
		await expect(voter.getByText(/^1 vote$/)).toBeVisible();

		await voter.context().close();
	});

	test('after-close mode hides counts until closed', async ({ page, browser }) => {
		const id = await createPoll(page, {
			question: 'Secret tally',
			options: ['A', 'B'],
			afterClose: true
		});

		const voter = await newVoter(browser, id);
		await voter.getByRole('radio', { name: 'A', exact: true }).click();
		await voter.getByRole('button', { name: 'Vote', exact: true }).click();
		await expect(voter.getByText('1 vote so far')).toBeVisible();
		await expect(voter.getByText('Results will be revealed when the poll closes.')).toBeVisible();

		// creator closes; voter sees final results appear (via SSE)
		page.on('dialog', (d) => d.accept());
		await page.getByRole('button', { name: 'Close now' }).click();
		await expect(voter.getByText('Poll closed · final results')).toBeVisible({ timeout: 5000 });

		await voter.context().close();
	});

	test('incognito double-vote succeeds (documented tradeoff), same-device revote does not duplicate', async ({
		page,
		browser
	}) => {
		const id = await createPoll(page, { question: 'Double?', options: ['X', 'Y'] });

		const voterA = await newVoter(browser, id);
		await voterA.getByRole('radio', { name: 'X', exact: true }).click();
		await voterA.getByRole('button', { name: 'Vote', exact: true }).click();
		await expect(voterA.getByText(/^1 vote$/)).toBeVisible();

		// fresh context = incognito: second vote counts (accepted tradeoff)
		const voterB = await newVoter(browser, id);
		await voterB.getByRole('radio', { name: 'X', exact: true }).click();
		await voterB.getByRole('button', { name: 'Vote', exact: true }).click();
		await expect(voterB.getByText(/^2 votes$/)).toBeVisible();

		await voterA.context().close();
		await voterB.context().close();
	});
});

test.describe('Flow B: geofenced vote', () => {
	const ORIGIN = { latitude: 37.77925, longitude: -122.41924 };

	async function createGeofencedPoll(browser: Browser): Promise<{ id: string; page: Page }> {
		const context = await browser.newContext({
			geolocation: { ...ORIGIN, accuracy: 10 },
			permissions: ['geolocation']
		});
		const page = await context.newPage();
		await page.goto('/');
		await page.getByLabel('Poll question').fill('Nearby only');
		await page.getByRole('textbox', { name: 'Option 1', exact: true }).fill('In');
		await page.getByRole('textbox', { name: 'Option 2', exact: true }).fill('Out');
		await page.getByRole('button', { name: /Settings/ }).click();
		await page.getByLabel('Limit voting to people nearby').click();
		await expect(page.getByRole('button', { name: '100 m' })).toBeVisible();
		await page.getByRole('button', { name: '100 m' }).click();
		await page.getByRole('button', { name: 'Create poll' }).click();
		await page.waitForURL(/\/p\/[A-Z2-9]{4}/);
		const id = page.url().match(/\/p\/([A-Z2-9]{4})/)![1];
		return { id, page };
	}

	test('vote succeeds within the radius', async ({ browser }) => {
		const { id, page } = await createGeofencedPoll(browser);

		const context = await browser.newContext({
			geolocation: { latitude: 37.7793, longitude: -122.41924, accuracy: 15 },
			permissions: ['geolocation']
		});
		const voter = await context.newPage();
		await voter.goto(`/p/${id}`);
		await voter.getByRole('radio', { name: 'In', exact: true }).click();
		await voter.getByRole('button', { name: 'Vote', exact: true }).click();
		await expect(voter.getByText(/^1 vote$/)).toBeVisible();

		await context.close();
		await page.context().close();
	});

	test('vote fails outside the radius with a distance message', async ({ browser }) => {
		const { id, page } = await createGeofencedPoll(browser);

		// ~2.3 km south
		const context = await browser.newContext({
			geolocation: { latitude: 37.7585, longitude: -122.4194, accuracy: 15 },
			permissions: ['geolocation']
		});
		const voter = await context.newPage();
		await voter.goto(`/p/${id}`);
		await voter.getByRole('radio', { name: 'In', exact: true }).click();
		await voter.getByRole('button', { name: 'Vote', exact: true }).click();
		await expect(voter.getByText("You're too far away")).toBeVisible();
		await expect(voter.getByText(/You appear to be ~2\.\d km away/)).toBeVisible();

		await context.close();
		await page.context().close();
	});

	test('denied location shows friendly error and no vote is possible', async ({ browser }) => {
		const { id, page } = await createGeofencedPoll(browser);

		// permission granted but no position available → getCurrentPosition
		// rejects, same handling as an explicit denial
		const context = await browser.newContext({ permissions: ['geolocation'] });
		const voter = await context.newPage();
		await voter.goto(`/p/${id}`);
		await voter.getByRole('radio', { name: 'In', exact: true }).click();
		await voter.getByRole('button', { name: 'Vote', exact: true }).click();
		// no position ever arrives, so the browser rejects after the app's own
		// 15s geolocation timeout — wait past it
		await expect(voter.getByText('Location needed')).toBeVisible({ timeout: 20_000 });
		await expect(voter.getByText('never stored')).toBeVisible();

		await context.close();
		await page.context().close();
	});
});

test.describe('Flow C: watch / close', () => {
	test('creator closes early; voting is frozen', async ({ page, browser }) => {
		const id = await createPoll(page, { question: 'Close me', options: ['A', 'B'] });

		page.on('dialog', (d) => d.accept());
		await page.getByRole('button', { name: 'Close now' }).click();
		await expect(page.getByText('Poll closed · final results')).toBeVisible({ timeout: 5000 });

		// new visitor sees final results, no vote form
		const visitor = await newVoter(browser, id);
		await expect(visitor.getByText('Poll closed · final results')).toBeVisible();
		await expect(visitor.getByRole('button', { name: 'Vote', exact: true })).toHaveCount(0);
		await visitor.context().close();
	});

	test('creator deletes; poll 404s identically to unknown codes', async ({ page, browser }) => {
		const id = await createPoll(page, { question: 'Delete me', options: ['A', 'B'] });

		page.on('dialog', (d) => d.accept());
		await page.getByRole('button', { name: 'Delete' }).click();
		await page.waitForURL('/');

		const visitor = await browser.newContext().then((c) => c.newPage());
		const deletedRes = await visitor.goto(`/p/${id}`);
		expect(deletedRes!.status()).toBe(404);
		await expect(visitor.getByText('Nothing here')).toBeVisible();

		const bogusRes = await visitor.goto('/p/QQQQ');
		expect(bogusRes!.status()).toBe(404);
		await expect(visitor.getByText('Nothing here')).toBeVisible();
		await visitor.context().close();
	});

	test('code entry on home page joins a poll', async ({ page, browser }) => {
		const id = await createPoll(page, { question: 'Join by code', options: ['A', 'B'] });

		const visitor = await browser.newContext().then((c) => c.newPage());
		await visitor.goto('/');
		await visitor.getByLabel('Poll code').fill(id.toLowerCase());
		await visitor.getByRole('button', { name: 'Go' }).click();
		await visitor.waitForURL(`/p/${id}`);
		await expect(visitor.getByRole('heading', { name: 'Join by code' })).toBeVisible();
		await visitor.context().close();
	});
});
