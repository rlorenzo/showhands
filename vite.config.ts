import { execFileSync } from 'node:child_process';

import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// The commit this bundle was built from, baked in at build time and served by
// /healthz so a stale deploy can be told apart from a fresh one. Falls back to
// "unknown" rather than throwing, so a missing git context fails neither the
// config load nor the build. It does not go unnoticed: "unknown" can never
// equal the commit being deployed, so the deploy gate trips on it, by design.
//
// `cwd` is pinned to this file's directory, not inherited: the droplet builds
// via `npm --prefix "$APP_DIR" run build`, which leaves cwd at root's working
// directory, so an inherited cwd would resolve outside the repo.
function buildVersion(): string {
	try {
		return execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: import.meta.dirname,
			stdio: ['ignore', 'pipe', 'ignore']
		})
			.toString()
			.trim();
	} catch {
		return 'unknown';
	}
}

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// Doubles as SvelteKit's app version, so the `updated` store tracks the
			// deployed commit instead of a build timestamp.
			version: { name: buildVersion() },
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:', 'https://tile.openstreetmap.org'],
					'connect-src': ['self'],
					// GitHub Sponsors button in the site footer
					'frame-src': ['https://github.com/sponsors/'],
					'frame-ancestors': ['none'],
					'base-uri': ['self'],
					'form-action': ['self']
				}
			}
		})
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'node'
	}
});
