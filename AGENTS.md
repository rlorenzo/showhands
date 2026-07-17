# Show of Hands — Agent Guide

Dead-simple ephemeral polling ("Jackbox for decisions"). Create a poll in
under 15 seconds, share via QR code or 4-letter code, votes update live,
polls self-destruct. No accounts, ever.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # production build (adapter-node → build/)
npm run test         # vitest unit tests (run once)
npm run test:e2e     # Playwright end-to-end
npm run check        # svelte-check + TypeScript
npm run lint         # Biome check
npm run format       # Biome check --write
```

CI deploys `main` to https://showhands.rexlorenzo.com (bare-metal droplet,
systemd + Caddy — see `deploy/`). `GET /healthz` is the uptime probe.

## Stack & architecture

- SvelteKit 2 / Svelte 5 (runes: `$state`, `$derived`, `$props`), TypeScript,
  single Node server via `@sveltejs/adapter-node`.
- SQLite through `better-sqlite3` (`src/lib/server/db.ts`); data is
  disposable by design.
- Live results over Server-Sent Events (`/api/polls/:id/stream`,
  `src/lib/server/broadcast.ts`) with automatic 3s-polling fallback.
- Server-only logic lives in `src/lib/server/`; shared validation and types
  in `src/lib/validation.ts` and `src/lib/types.ts`.
- Routes: `/` (create + join), `/p/[id]` (vote + live results + share),
  `/about`, JSON API under `/api/polls`.

## Hard product constraints (do not violate)

- **Privacy is load-bearing.** Voter coordinates are checked in memory and
  never stored or logged. Anonymous mode means display names are never
  persisted. Don't add analytics, fingerprinting, or logging that breaks
  the README's promises.
- **Ephemerality is the feature.** Polls expire, then hard-delete. Never add
  retention hooks, accounts, or anything that fights self-destruction.
- Missing and expired polls must 404 identically (anti-enumeration).
- Rate limits live in `src/lib/server/ratelimit.ts`; keep new endpoints
  behind them.

## Design context

Design work is governed by two root files — read them before touching UI:

- **`PRODUCT.md`** — strategy: product register; "loud, live, honest" party
  energy (never juvenile); anti-references (corporate survey tools, SaaS
  landing gloss, childish party apps, engagement-bait); WCAG 2.2 AA.
- **`DESIGN.md`** — the visual system ("The Raised Hand"): Bonfire Orange
  `#e85d2f` is the only meaningful color (One Flame Rule); one system font
  family, hierarchy by weight; flat ambient elevation (one card shadow);
  chunky & tappable components (52px primary buttons).

Practical rules that follow:

- Tokens are CSS custom properties in `src/app.css`; use them, don't inline
  new hex values.
- Every animation must respect the global `prefers-reduced-motion` kill
  switch in `src/app.css`.
- Live-updating numbers get `font-variant-numeric: tabular-nums`.
- Mobile-first inside the 480px `.shell`; tap targets ≥40px.

## Conventions

- Biome for lint + format (tabs, single quotes in TS; run `npm run format`
  before committing).
- Svelte 5 runes only — no legacy `$:` reactive statements or stores where
  runes suffice.
- Unit tests colocate as `*.test.ts` next to the module; e2e specs in `e2e/`.
