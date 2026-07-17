import { expect, type Page, test } from '@playwright/test';

function metaContent(page: Page, selector: string): Promise<string | null> {
	return page.locator(selector).getAttribute('content');
}

test.describe('SEO / social meta', () => {
	test('home page emits canonical + Open Graph card', async ({ page }) => {
		await page.goto('/');
		// Protocol depends on the ORIGIN env (adapter-node assumes https when unset),
		// so assert host + path + absolute shape rather than a fixed scheme.
		const { host } = new URL(page.url());

		await expect(page).toHaveTitle('Show of Hands - instant polls for people nearby');
		expect(await metaContent(page, 'meta[name="description"]')).toContain(
			'Create a poll in seconds'
		);
		expect(await metaContent(page, 'meta[property="og:title"]')).toBe(
			'Show of Hands - instant polls for people nearby'
		);
		expect(await metaContent(page, 'meta[name="twitter:card"]')).toBe('summary_large_image');
		// image path is absolutized against the request origin so unfurlers can fetch it
		expect(await metaContent(page, 'meta[property="og:image"]')).toMatch(
			new RegExp(`^https?://${host}/og\\.png$`)
		);
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			new RegExp(`^https?://${host}/$`)
		);
	});

	test('poll page keeps the question out of the social card and stays noindex', async ({
		page
	}) => {
		const question = 'Where should the offsite be?';
		await page.goto('/');
		await page.getByLabel('Poll question').fill(question);
		await page.getByRole('textbox', { name: 'Option 1', exact: true }).fill('Lisbon');
		await page.getByRole('textbox', { name: 'Option 2', exact: true }).fill('Tokyo');
		await page.getByRole('button', { name: 'Create poll' }).click();
		await page.waitForURL(/\/p\/[A-Z2-9]{4}/);

		// The document title (local browser history only) may carry the question…
		await expect(page).toHaveTitle(`${question} - Show of Hands`);

		// …but the shareable social card must not — privacy is load-bearing.
		const ogTitle = await metaContent(page, 'meta[property="og:title"]');
		const ogDescription = await metaContent(page, 'meta[property="og:description"]');
		expect(ogTitle).toBe('Vote now · Show of Hands');
		expect(ogTitle).not.toContain(question);
		expect(ogDescription).not.toContain(question);

		// Ephemeral polls are noindex, and carry no canonical (conflicting signals).
		expect(await metaContent(page, 'meta[name="robots"]')).toBe('noindex');
		await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
	});
});
