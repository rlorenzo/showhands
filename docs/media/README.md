# Demo media

The reusable demo assets for Show of Hands: one 15-second loop that captures
the whole thing (create a poll, throw the QR up, phones vote, bars land with
weight, a winner emerges). Every promotion card can build on these.

| File | What it is | Use |
| --- | --- | --- |
| `demo.webp` | ~15s silent loop, 520×901, animated WebP (~0.4 MB) | README embed, directories, inline embeds |
| `demo-social.mp4` | ~22s captioned cut, 1200×2080, H.264 (~1.5 MB) | Product Hunt, X, Bluesky, Mastodon |
| `still-create.png` | The create screen, 1200×2080 | PH gallery |
| `still-results.png` | Live results mid-climb, 1200×2080 | PH gallery |
| `still-winner.png` | Closed poll, winner emerges, 1200×2080 | PH gallery |
| `still-share.png` | The QR + 4-letter code, 1200×2080 | PH gallery |

Why WebP over GIF: the same loop is a 2.3 MB GIF but a 0.4 MB animated WebP —
about 6× smaller, with true color instead of 256 and smoother motion. GitHub
renders and loops animated WebP inline just like a GIF. The 1200×630 social
card image lives at `static/og.png` (referenced by the meta tags).

Reduced motion: these are standalone assets. If any of them ever autoplays on
the site itself, gate it behind the global `prefers-reduced-motion` kill switch
in `src/app.css`.

## Regenerating

```bash
brew install ffmpeg webp      # ffmpeg + img2webp
bash docs/media/build.sh
```

`build.sh` builds the app, starts a throwaway server (rate limits off, scratch
DB), then:

1. **`record-demo.mjs`** drives the real build through the full loop on one
   recorded "phone" viewport (600×1040). Background Playwright request-contexts
   — each a fresh signed device cookie, so each is a distinct voter — cast real
   votes on a ~430 ms cadence, so the bars climb live over SSE. It also grabs
   the four stills. The sample poll ("Where should we eat?" → Tacos / Ramen /
   Pizza / Salad) is tuned so Tacos and Ramen tie 5–5 mid-climb before Tacos
   pulls ahead to win.
2. **`render-overlays.mjs`** renders the caption pills and end card as
   brand-matched PNGs (the app's own system font and card tokens).
3. **ffmpeg + img2webp** encode the WebP loop and composite the captioned MP4
   (2× scale, four beat-timed caption overlays, crossfade to the end card).

To change the sample poll or the caption copy, edit those two scripts and
re-run `build.sh`.
