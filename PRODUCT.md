# Product

## Register

product

## Users

Groups of people physically together (or in the same group chat) who need to
make a quick decision: friends picking a restaurant, a class, a meetup, a
team, a party table. The creator builds the poll on their phone in under 15
seconds; voters scan a QR code or type a 4-letter code and vote from their
phone browser — often outdoors, one-handed, in a hurry, on whatever device
they happen to have. Nobody has an account and nobody wants one.

## Product Purpose

Dead-simple ephemeral polling — "Jackbox for decisions." Create a poll, throw
the QR code on the table, watch votes land live, decision made. An optional
proximity gate keeps voting to people actually in the room or area. Success
is time-to-decision measured in seconds, zero onboarding, and the poll
self-destructing afterward exactly as promised. The privacy story (no
accounts, locations never stored, honest anonymity) is a core feature, not
fine print.

## Brand Personality

Full party energy: loud, warm, celebratory. Live results should feel like a
crowd reacting, not a spreadsheet updating — a vote landing should have
weight, and real moments (poll closing, a winner emerging) deserve real
payoff. Three words: **loud, live, honest.** The energy is grown-up party —
Jackbox with adults at the table — never juvenile. And wherever privacy or
vote mechanics appear on screen, the voice drops the party and turns precise
and plain-spoken.

## Anti-references

- **Corporate survey tools** (SurveyMonkey, Google Forms, Microsoft Forms):
  bureaucratic form stacks, enterprise gray, "Page 1 of 3."
- **SaaS landing gloss**: gradient heroes, feature grids, pricing-page
  energy. The home page is the tool, not the pitch.
- **Childish party apps**: confetti-everywhere, cartoon mascots, badges,
  gamification. Loud ≠ juvenile.
- **Engagement-bait UX**: streaks, notifications, retention hooks — anything
  that fights the app's self-destructing ethos.

## Design Principles

1. **The table is the room.** Design for a phone scanned at arm's length and
   passed around: huge touch targets, glanceable results, instant
   comprehension from a meter away.
2. **Votes are events, not rows.** Live results deserve motion with weight —
   a vote landing should feel like a hand going up. Celebrate real moments
   (close, winner); stay silent everywhere else.
3. **Party in the visuals, lawyer in the fine print.** Energy comes from
   color, motion, and scale. Privacy and vote-mechanics copy stays literal
   and unhedged — the honesty is part of the brand.
4. **15 seconds or it's broken.** Every added field, screen, or decision on
   the create path is a regression. Defaults do the work; settings stay
   folded.
5. **Ephemerality is a feature to show.** Expiry and self-destruction are
   surfaced proudly (countdowns, "this poll will vanish"), never buried like
   a limitation.

## Accessibility & Inclusion

WCAG 2.2 AA. Body text ≥ 4.5:1 contrast; full keyboard operability; visible
focus states. Every celebration or live-result animation needs a
reduced-motion alternative (a global kill switch already exists in
`src/app.css` — keep it honored as motion grows). Design for the real
context: outdoor glare, one-handed use, hurried voters, older Android
phones — favor big targets and high contrast over subtlety.
