import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	timeout: 30_000,
	fullyParallel: false, // shared SQLite database; keep runs deterministic
	workers: 1,
	use: {
		baseURL: 'http://localhost:4300',
		// CI containers may pre-install a Chromium that doesn't match this
		// Playwright version; point at it explicitly instead of downloading.
		launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
			? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
			: undefined
	},
	webServer: {
		command: 'npm run build && node build/index.js',
		port: 4300,
		env: {
			PORT: '4300',
			DATABASE_PATH: 'data/e2e-test.db',
			SHOWHANDS_SECRET: 'e2e-secret-not-for-production',
			SHOWHANDS_DISABLE_RATE_LIMITS: '1'
		},
		reuseExistingServer: false,
		timeout: 120_000
	}
});
