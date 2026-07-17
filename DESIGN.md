---
name: Show of Hands
description: Dead-simple ephemeral polling — create, scan, vote, watch it live, then it vanishes.
colors:
  bonfire: "#e85d2f"
  bonfire-deep: "#c94a20"
  bonfire-deeper: "#a83c17"
  bonfire-wash: "#fdeee7"
  faded-ember: "#ee8d6b"
  warm-ink: "#1c1917"
  smoke: "#78716c"
  warm-white: "#faf8f5"
  card-white: "#ffffff"
  warm-line: "#e7e2dc"
  veto-red: "#b91c1c"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.05em"
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  card: "14px"
  button: "12px"
  input: "10px"
  select: "8px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.bonfire-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    padding: "12px 18px"
    height: "52px"
  button-primary-active:
    backgroundColor: "{colors.bonfire-deeper}"
  button-secondary:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.button}"
    padding: "12px 18px"
    height: "52px"
  button-danger:
    textColor: "{colors.veto-red}"
    rounded: "{rounded.button}"
    padding: "12px 18px"
  chip:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  chip-active:
    backgroundColor: "{colors.bonfire-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  input-text:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.input}"
    padding: "13px 14px"
  card:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.card}"
    padding: "16px"
  code-tile:
    backgroundColor: "{colors.bonfire-wash}"
    textColor: "{colors.bonfire-deep}"
    rounded: "{rounded.input}"
    padding: "4px 12px"
---

# Design System: Show of Hands

## 1. Overview

**Creative North Star: "The Raised Hand"**

Every interaction is modeled on the gesture itself: a hand goes up — quick,
visible, unmistakable — it gets counted, and then it comes down. Nothing
lingers. The interface is a single warm column built for a phone held at a
party table: one question, big targets, instant comprehension from a meter
away. Energy comes from Bonfire Orange, motion with weight, and bold type —
never from decoration, chrome, or density.

This is a grown-up party tool, loud where it celebrates and plain-spoken
where it promises. It explicitly rejects the corporate survey look
(form stacks, enterprise gray, "Page 1 of 3"), SaaS landing gloss (gradient
heroes, feature grids), childish party-app kitsch (mascots, badges,
confetti-everywhere), and every engagement-bait pattern — the product
self-destructs on purpose, and the design must never fight that.

**Key Characteristics:**
- Single 480px column; mobile-first, thumb-first, glanceable.
- One accent (Bonfire Orange) carries all action and state.
- One system font family; hierarchy through weight (400 → 800) and size.
- Flat warm surfaces with a single ambient shadow; motion, not depth, carries the energy.
- Chunky & tappable: 52px buttons, fat radii, pill chips.

## 2. Colors

A restrained warm-neutral field where one flame does all the talking.

### Primary
- **Bonfire Orange** (#e85d2f): The single voice of action and state — as a
  *graphic*: the leading result bar, focus outlines, the map pin, the winner
  glow, the PWA theme color. It marks *what matters right now* — never
  texture, never decoration. It is NOT a background for normal-size text
  (white on it is 3.48:1, an AA failure).
- **Bonfire Deep** (#c94a20): The text-bearing flame. Primary buttons and
  active chips fill with Bonfire Deep so their white labels clear WCAG AA
  (4.69:1). Also the "✓ you" marker on white.
- **Bonfire Deeper** (#a83c17): The pressed state of Bonfire Deep, and text
  on Bonfire Wash (5.6:1) — e.g. the vote-counted note.
- **Bonfire Wash** (#fdeee7): A pale ember tint for celebratory-but-quiet
  fills: the poll-code tiles, the vote-counted note, secondary-button pressed
  state. The only permitted large field of accent-family color.
- **Faded Ember** (#ee8d6b): Trailing result bars only — the crowd behind
  the leader. Never interactive, never text.

### Neutral
- **Warm Ink** (#1c1917): All primary text and headings. Near-black with a
  warm cast; never pure #000.
- **Smoke** (#78716c): Secondary text only — helper lines, counts, footer
  links. At 4.5:1 on Warm White it passes AA by a hair: keep it to short
  labels, never paragraphs.
- **Warm White** (#faf8f5): The page background. Warm, matte, unbranded.
- **Card White** (#ffffff): Elevated surfaces — cards, inputs, chips.
- **Warm Line** (#e7e2dc): Borders, dividers, and empty result-bar tracks.
- **Veto Red** (#b91c1c): Errors and destructive actions (delete poll,
  geofence rejection) exclusively. Never for emphasis or energy.

### Named Rules
**The One Flame Rule.** Bonfire Orange is the only color allowed to mean
something. If two different hues compete for attention on one screen, one of
them is wrong. Danger speaks in Veto Red only when something is being
destroyed or refused — and destruction is a quiet action here, not a red
button screaming.

**The No-Gray Rule.** Nothing in this system is cool gray. Every neutral
carries the warm stone cast (#1c1917 → #e7e2dc family). A cool gray anywhere
reads as the corporate survey tool this product refuses to be.

## 3. Typography

**Display Font:** system-ui (with -apple-system, "Segoe UI", Roboto fallbacks)
**Body Font:** same single family

**Character:** One well-tuned system sans doing everything — native, fast,
and invisible, so weight and scale can shout when the moment earns it.
Loudness is 800-weight and big, not a novelty font.

### Hierarchy
- **Display** (800, 2rem, 0.05em tracking): The 4-letter poll code, rendered
  as individual tiles. The loudest text in the system; reserved for the
  share moment.
- **Headline** (700, 1.6rem, 1.2): The poll question — the `h1` of every
  screen. `overflow-wrap: anywhere` because user text is hostile text.
- **Title** (600, 0.95rem): Option labels, settings-row labels, button-adjacent
  emphasis.
- **Body** (400, 1rem, 1.45): Prose and descriptions. The 480px shell keeps
  line length naturally inside 65–75ch.
- **Label** (400, 0.9rem): Muted helper text in Smoke; short lines only.
- **Numbers**: vote counts and percentages always set with
  `font-variant-numeric: tabular-nums` so live tallies don't jitter.

### Named Rules
**The One Family Rule.** No second typeface, ever. No display font, no mono
flourish. Hierarchy is built from weight (400/600/700/800) and size alone.

## 4. Elevation

Flat, ambient paper. Surfaces sit nearly flush on the warm background with a
single soft ambient shadow (`0 1px 3px rgba(28,25,23,0.08), 0 4px 16px
rgba(28,25,23,0.06)`) plus a 1px Warm Line border. Depth never carries
meaning — color and motion do. There is no shadow scale, no hover-lift
vocabulary, no layering hierarchy to learn.

### Shadow Vocabulary
- **Ambient card** (`box-shadow: 0 1px 3px rgba(28, 25, 23, 0.08), 0 4px 16px rgba(28, 25, 23, 0.06)`):
  The only shadow. Applied to `.card` surfaces; always paired with a 1px
  Warm Line border.

### Named Rules
**The Paper Table Rule.** Everything lies flat on the table. If a design
needs a second shadow step to communicate state, use Bonfire Orange or
motion instead.

## 5. Components

The vocabulary is chunky & tappable: built for thumbs, glare, and hurry.
Every interactive element is at least 40px tall; primary actions are 52px.

### Buttons
- **Shape:** Generously rounded (12px radius), full-width by default in the
  single column.
- **Primary:** Bonfire Deep fill (AA-safe under white text), white 700-weight
  text at 1.05rem, 52px min-height, `touch-action: manipulation`. There is
  exactly one per screen.
- **Active / Pressed:** Fill darkens to Bonfire Deeper (#a83c17) with a
  slight 0.985 scale press — color-first tactility.
- **Disabled:** 45% opacity, cursor default — never a gray restyle.
- **Secondary:** Card White fill, 1.5px Warm Line border, 600-weight Warm Ink
  text; presses into Bonfire Wash.
- **Danger:** Transparent fill, Veto Red text, 35%-alpha red border. Quietest
  button in the system by design.
- **Small variant:** auto width, 40px min-height, 0.9rem, for inline actions
  ("+ Add option", "Go").

### Chips
- **Style:** Full pill (999px), Card White fill, 1.5px Warm Line border,
  600-weight text; used for the geofence radius picker.
- **State:** Selected chip fills solid Bonfire Orange with white text — a
  binary flip, no in-between tints.

### Cards / Containers
- **Corner Style:** 14px radius.
- **Background:** Card White on Warm White.
- **Shadow Strategy:** the single ambient card shadow (see Elevation).
- **Border:** always 1px Warm Line; shadow never appears without it.
- **Internal Padding:** 16px; internal stacks gap at 12–14px.

### Inputs / Fields
- **Style:** Card White fill, 1.5px Warm Line border, 10px radius, 13px/14px
  padding; font inherits (never smaller than body — no iOS zoom).
- **Focus:** 2px solid Bonfire Orange outline at 1px offset; the border
  itself goes transparent. Focus is loud on purpose.
- **Join-code input:** uppercase, 700 weight, 0.35em letter-spacing —
  typing a code should feel like entering a game.

### Navigation
- **Style:** No nav chrome. A single 800-weight wordmark ("✋ Show of Hands")
  links home; a one-line Smoke footer links to "How it works & privacy".
  Anything more is bureaucracy.

### Result Bars (signature component)
- **Anatomy:** per-option label row (600-weight label, tabular-nums count ·
  percent in Smoke) over a 14px full-pill track in Warm Line.
- **Fill:** leaders fill solid Bonfire Orange; trailing options fill Faded
  Ember (#ee8d6b). The leader is findable at a glance from across the table.
- **Motion:** bars scale in (`transform: scaleX`, never `width`) 400ms on
  `--ease-out-quint` — the hand going up — with a 50ms-per-row stagger on
  first reveal. Live counts tick in with a 200ms rise. Votes land with
  weight; nothing else on the screen moves.
- **Winner reveal (closed polls):** the winning row promotes to 800-weight
  with a ✋ mark and its track pulses one 900ms Bonfire glow ring; losing
  labels recede to Smoke. The entire celebration budget is spent here.
- **Your vote:** marked "✓ you" in Bonfire Deep beside the label.

### Code Tiles (signature component)
- **Style:** each of the 4 letters sits in its own Bonfire Wash tile (10px
  radius, 4px/12px padding), Display type in Bonfire Deep. The share moment
  is the loudest, warmest frame in the app.

## 6. Do's and Don'ts

### Do:
- **Do** route all emphasis through the One Flame Rule: Bonfire Orange
  (#e85d2f) for action and state, weight/size for text emphasis, nothing else.
- **Do** put white text only on Bonfire Deep (#c94a20) or darker — Bonfire
  Orange is a graphic color, not a text background.
- **Do** keep every tap target ≥40px and primary actions at 52px — voters
  are one-handed, outdoors, and in a hurry.
- **Do** animate votes landing (the 400ms ease-out bar) and reserve
  celebration for real moments: poll close, winner revealed. Silence
  everywhere else.
- **Do** honor the global reduced-motion kill switch in `src/app.css` for
  every new animation — celebrations degrade to crossfades or instant states.
- **Do** use `tabular-nums` on every live-updating number.
- **Do** keep Smoke (#78716c) to short secondary lines; body copy is Warm Ink.
- **Do** keep privacy and vote-mechanics copy literal and unhedged — "party
  in the visuals, lawyer in the fine print."

### Don't:
- **Don't** look like the **corporate survey tools** (SurveyMonkey, Google
  Forms): no form stacks, no enterprise gray, no "Page 1 of 3", no cool-gray
  neutrals anywhere.
- **Don't** add **SaaS landing gloss**: no gradient heroes, no gradient text,
  no feature grids, no glassmorphism — the home page is the tool, not the pitch.
- **Don't** drift into the **childish party app**: no mascots, no badges, no
  confetti-everywhere, no bounce or elastic easing. Loud ≠ juvenile.
- **Don't** ship **engagement-bait**: no streaks, no notifications, no
  retention hooks — nothing that fights the self-destructing ethos.
- **Don't** introduce a second typeface, a second accent hue, or a second
  shadow step. One family, one flame, one ambient shadow.
- **Don't** use colored side-stripe borders (`border-left > 1px`) on cards or
  alerts, ever.
- **Don't** make destructive actions loud — Veto Red is a quiet outline, not
  a filled alarm button.
