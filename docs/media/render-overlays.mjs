// Render the social MP4's caption pills + end card as brand-matched PNG
// overlays (system font, app card tokens) at 2x, so they composite crisp onto
// the demo video. See build.sh for how they're overlaid.
//
//   OUT_DIR=./out node docs/media/render-overlays.mjs
import pw from '@playwright/test';

const { chromium } = pw;

const OUT = process.env.OUT_DIR ?? '.';
const W = 600,
	H = 1040; // CSS px; DSF 2 -> 1200x2080 output

// These render standalone HTML outside the app, so they can't read the CSS
// custom properties in src/app.css — the hexes below MIRROR those tokens and
// must be kept in sync by hand:
//   #e85d2f --accent · #c94a20 --accent-dark · #faf8f5 --bg · #ffffff --surface
//   #1c1917 --text · #78716c --text-muted · #e7e2dc --border
// FONT mirrors the app's body font-family (system-ui stack).
const FONT = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";

const ICON = `<svg viewBox="0 0 32 32" width="132" height="132" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="7" fill="#e85d2f"/>
  <g fill="#fff">
    <rect x="9.3" y="7.6" width="3.2" height="11" rx="1.6"/>
    <rect x="13.3" y="5.6" width="3.2" height="13" rx="1.6"/>
    <rect x="17.3" y="6.6" width="3.2" height="12" rx="1.6"/>
    <rect x="21.3" y="9.2" width="3" height="9.5" rx="1.5"/>
    <rect x="6.4" y="14.6" width="3.4" height="9" rx="1.7" transform="rotate(-38 8.1 19.1)"/>
    <path d="M9.3 14.5h15v4.6c0 4.4-3.4 7.4-7.6 7.4-4.1 0-7.4-3-7.4-7.4z"/>
  </g>
</svg>`;

// App-style white "card" caption pill, pinned near the bottom of the frame.
const captionHtml = (text) => `<!doctype html><html><head><meta charset="utf8">
<style>
  html,body{margin:0;width:${W}px;height:${H}px;background:transparent}
  .wrap{position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:center;padding:0 22px 58px}
  .pill{
    max-width:520px;text-align:center;
    background:#ffffff;border:1px solid #e7e2dc;border-radius:14px;
    box-shadow:0 1px 3px rgba(28,25,23,.08),0 4px 16px rgba(28,25,23,.06);
    padding:15px 24px;font-family:${FONT};
    font-size:31px;line-height:1.25;font-weight:800;letter-spacing:-.01em;color:#1c1917;
  }
</style></head><body><div class="wrap"><div class="pill">${text}</div></div></body></html>`;

const endCardHtml = `<!doctype html><html><head><meta charset="utf8">
<style>
  html,body{margin:0;width:${W}px;height:${H}px;background:#faf8f5}
  .wrap{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;font-family:${FONT};text-align:center;padding:0 40px}
  .name{font-size:48px;font-weight:800;letter-spacing:-.02em;color:#1c1917}
  .url{font-size:27px;font-weight:700;color:#c94a20}
  .tag{font-size:24px;font-weight:500;color:#78716c;margin-top:2px}
</style></head><body><div class="wrap">
  ${ICON}
  <div class="name">Show of Hands</div>
  <div class="url">showhands.rexlorenzo.com</div>
  <div class="tag">No accounts, for anyone, ever.</div>
</div></body></html>`;

const CAPTIONS = {
	cap1: 'Create a poll in seconds',
	cap2: 'Share a QR or 4-letter code',
	cap3: 'Votes land live',
	cap4: 'One winner. Then it self-destructs.'
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

for (const [name, text] of Object.entries(CAPTIONS)) {
	await page.setContent(captionHtml(text), { waitUntil: 'load' });
	await page.screenshot({ path: `${OUT}/overlays/${name}.png`, omitBackground: true });
}
await page.setContent(endCardHtml, { waitUntil: 'load' });
await page.screenshot({ path: `${OUT}/overlays/endcard.png` });

await browser.close();
console.log('overlays rendered');
