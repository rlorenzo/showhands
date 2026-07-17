<svelte:head>
	<title>How it works - Show of Hands</title>
	<meta
		name="description"
		content="How Show of Hands polls, proximity checks, anonymity, and self-destruction work."
	/>
</svelte:head>

<h1>How it works</h1>

<section>
	<h2>The 15-second pitch</h2>
	<p>
		Create a poll, throw the QR code on the table (or a screen), everyone votes from their phone
		browser, results update live. No apps, no accounts. For anyone, ever.
	</p>
</section>

<section>
	<h2>Polls self-destruct</h2>
	<p>
		Every poll has an expiry (1 hour to 7 days, default 24 hours). After it expires, results stay
		visible for a 24-hour grace window, then the poll and all its votes are
		<strong>permanently deleted</strong>. There is no archive and no undo.
	</p>
</section>

<section>
	<h2>What "only people nearby" does</h2>
	<p>
		A creator can require voters to be within a radius (100 m to 5 km) of where the poll was
		created. When you vote on such a poll, your browser asks for your location once; the server
		checks the distance in memory and keeps only pass/fail. Your coordinates are
		<strong>never stored or logged</strong>. The creator's location is kept only while the poll
		exists (rounded to ~11 m precision) and deleted with it.
	</p>
	<p>
		<strong>Honest limitation:</strong> a motivated person can spoof browser geolocation. This is a social
		tool for friends, coworkers, and events, not a secure election system. GPS is also fuzzy indoors,
		so the check allows a reasonable accuracy margin; if legit voters get rejected, the creator can widen
		the radius.
	</p>
</section>

<section>
	<h2>Anonymity, honestly</h2>
	<p>
		Anonymous polls (the default) never associate votes with names: the server refuses to store a
		name even if one is sent. Named polls show the voter list to everyone watching results.
	</p>
</section>

<section>
	<h2>One vote per device</h2>
	<p>
		A random cookie keeps one vote per device and lets you change your vote while the poll is open.
		This is best-effort: a private/incognito window gets a fresh cookie and could vote again. We
		accept that tradeoff rather than fingerprint your browser. There is no tracking, no third-party
		analytics, and no IP logging beyond short-lived standard server logs.
	</p>
</section>

<section>
	<h2>Lost the creator controls?</h2>
	<p>
		Creator powers (close early, delete, widen radius) live in a cookie on the device that made the
		poll. If that cookie is cleared, the poll simply runs to its expiry and self-destructs as usual.
	</p>
</section>

<style>
	section {
		margin-bottom: 24px;
	}

	h2 {
		font-size: 1.1rem;
		margin: 0 0 6px;
	}

	p {
		margin: 0 0 10px;
		color: var(--text-muted);
	}

	p strong {
		color: var(--text);
	}
</style>
