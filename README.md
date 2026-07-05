# ✋ Show of Hands

Dead-simple, ephemeral polling. Create a poll in under 15 seconds, throw the QR
code on the table, everyone votes from their phone browser, results update
live. **No accounts, for anyone, ever.** Polls self-destruct.

"Jackbox for decisions."

## What makes it different

- **Proximity gate (optional).** The creator can require voters to be within
  100 m – 5 km of where the poll was created. Voter coordinates are checked
  in memory on the server and **never stored or logged** — only pass/fail.
- **Radical ephemerality.** Polls expire (1h / 4h / 24h / 7d), stay readable
  for a 24h grace window, then are hard-deleted along with every vote.
- **Honest anonymity.** Anonymous mode means the server refuses to persist a
  display name at all — not "we hide it in the UI."

## Stack

- [SvelteKit](https://svelte.dev/docs/kit) (Svelte 5, TypeScript) as a single
  Node server (`@sveltejs/adapter-node`)
- SQLite via `better-sqlite3` — zero external services, data is disposable by
  design
- Server-Sent Events for live results (automatic fallback to 3s polling)
- Client-side QR generation (`qrcode`)

## Develop

```bash
npm install
npm run dev
```

## Test

```bash
npm run test        # vitest unit tests (haversine, IDs, sanitization, sweep, rate limits)
npm run test:e2e    # Playwright end-to-end (create / vote / geofence / close flows)
```

If your environment pre-installs a Chromium that doesn't match the Playwright
version, point the tests at it:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

## Build & run

```bash
npm run build
node build/index.js
```

Configuration (all optional):

| Env var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATABASE_PATH` | `./data/showhands.db` | SQLite file location |
| `SHOWHANDS_SECRET` | generated & persisted next to the DB | HMAC key for device/creator tokens |

Deploys as one container (Fly.io, Railway, anything that runs Node). Mount a
volume at `./data` if you want polls to survive restarts — losing them is
acceptable by design.

## Anti-abuse posture (documented tradeoffs)

- One vote per device via a signed random cookie. Incognito defeats it —
  accepted; we will not fingerprint browsers.
- Geolocation can be spoofed by a motivated user. This is a social tool, not
  a secure election system.
- Rate limits: 10 poll creations/IP/hour, 100 votes/IP/hour,
  20 votes/IP/poll/hour, and unknown-code lookups are throttled to prevent
  enumeration of the 4-character ID space. Missing and expired polls 404
  identically.

## API

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/polls` | POST | Create poll (sets creator cookie) |
| `/p/:id` | GET | SSR poll page (vote or results) |
| `/api/polls/:id/vote` | POST | Cast/replace vote (`{ optionIds, displayName?, lat?, lng?, accuracy? }`) |
| `/api/polls/:id/results` | GET | JSON results snapshot |
| `/api/polls/:id/stream` | GET | SSE live results |
| `/api/polls/:id/close` | POST | Close early (creator only) |
| `/api/polls/:id` | PATCH | Change geofence radius (creator only) |
| `/api/polls/:id` | DELETE | Delete immediately (creator only) |
