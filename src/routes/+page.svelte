<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Seo from '$lib/components/Seo.svelte';
	import {
		DEFAULT_EXPIRY,
		EXPIRY_CHOICES,
		type ExpiryKey, 
		OPTION_MAX,
		OPTIONS_MAX,
		OPTIONS_MIN,
		QUESTION_MAX,
		RADII_M
	} from '$lib/validation';

	let question = $state('');
	let options = $state(['', '']);
	let showSettings = $state(false);

	let isAnonymous = $state(true);
	let allowMulti = $state(false);
	let allowWritein = $state(false);
	let resultsVisibility = $state<'live' | 'after_close'>('live');
	let expiry = $state<ExpiryKey>(DEFAULT_EXPIRY);

	let geofenceOn = $state(false);
	let radiusM = $state<number>(250);
	let coords = $state<{ lat: number; lng: number; accuracy: number } | null>(null);
	let geoError = $state('');
	let locating = $state(false);

	let joinCode = $state('');
	let submitting = $state(false);
	let submitError = $state('');

	const filledOptions = $derived(options.map((o) => o.trim()).filter((o) => o.length > 0));
	const canSubmit = $derived(
		question.trim().length > 0 &&
			filledOptions.length >= OPTIONS_MIN &&
			(!geofenceOn || coords !== null) &&
			!submitting
	);

	function addOption() {
		if (options.length < OPTIONS_MAX) options = [...options, ''];
	}

	function removeOption(i: number) {
		if (options.length > OPTIONS_MIN) options = options.filter((_, idx) => idx !== i);
	}

	function toggleGeofence() {
		geoError = '';
		if (geofenceOn) {
			geofenceOn = false;
			coords = null;
			return;
		}
		if (!('geolocation' in navigator)) {
			geoError = 'Your browser does not support location.';
			return;
		}
		locating = true;
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				coords = {
					lat: pos.coords.latitude,
					lng: pos.coords.longitude,
					accuracy: pos.coords.accuracy
				};
				geofenceOn = true;
				locating = false;
			},
			() => {
				geoError =
					'Location was denied, so the proximity limit can’t be set. The poll will work without it.';
				locating = false;
			},
			{ enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
		);
	}

	// OpenStreetMap tile preview, no API key needed. A 3×3 grid at zoom+1 is
	// slid so the creator sits exactly at the viewport center; the circle is
	// drawn at real meters-per-pixel scale, so it's honest, not decorative.
	const ZOOM_FOR_RADIUS: Record<number, number> = { 100: 16, 250: 15, 1000: 13, 5000: 11 };
	const mapView = $derived.by(() => {
		if (!coords) return null;
		const z = (ZOOM_FOR_RADIUS[radiusM] ?? 15) + 1;
		const n = 2 ** z;
		const latRad = (coords.lat * Math.PI) / 180;
		const xf = ((coords.lng + 180) / 360) * n;
		const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
		const x0 = Math.floor(xf) - 1;
		const y0 = Math.min(Math.max(Math.floor(yf) - 1, 0), n - 3);
		const wrap = (x: number) => ((x % n) + n) % n;
		const tiles = [0, 1, 2].flatMap((row) =>
			[0, 1, 2].map(
				(col) => `https://tile.openstreetmap.org/${z}/${wrap(x0 + col)}/${y0 + row}.png`
			)
		);
		// Design units: the viewport is 256×192 (4:3); each tile renders at 128.
		// Shift the 3×3 canvas so the creator lands on the viewport center.
		const px = (xf - x0) * 128;
		const py = (yf - y0) * 128;
		const leftPct = ((128 - px) / 256) * 100;
		const topPct = ((96 - py) / 192) * 100;
		const metersPerTilePx = (156543.03392 * Math.cos(latRad)) / n;
		const rPx = radiusM / metersPerTilePx / 2;
		return { tiles, leftPct, topPct, rPx };
	});

	async function create(e: SubmitEvent) {
		e.preventDefault();
		if (!canSubmit) return;
		submitting = true;
		submitError = '';
		try {
			const res = await fetch('/api/polls', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					question: question.trim(),
					options: filledOptions,
					isAnonymous,
					allowMulti,
					allowWritein,
					resultsVisibility,
					expiry,
					geofence: geofenceOn && coords ? { lat: coords.lat, lng: coords.lng, radiusM } : null
				})
			});
			const data = await res.json();
			if (!res.ok) {
				submitError = data.error ?? 'Something went wrong. Try again.';
				submitting = false;
				return;
			}
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() is used; the rule can't see it through the query-string concatenation
			await goto(`${resolve('/p/[id]', { id: data.id })}?new=1`);
		} catch {
			submitError = 'Network error. Try again.';
			submitting = false;
		}
	}

	function join(e: SubmitEvent) {
		e.preventDefault();
		const code = joinCode.trim().toUpperCase();
		if (code.length === 4) goto(resolve('/p/[id]', { id: code }));
	}

	function radiusLabel(r: number): string {
		return r >= 1000 ? `${r / 1000} km` : `${r} m`;
	}
</script>

<Seo
	title="Show of Hands - instant polls for people nearby"
	description="Create a poll in seconds, share it with a QR code, watch votes live. No accounts, polls self-destruct."
/>

<h1>What are we deciding?</h1>

<form onsubmit={create}>
	<input
		type="text"
		placeholder="e.g. Where should we eat?"
		bind:value={question}
		maxlength={QUESTION_MAX}
		aria-label="Poll question"
		required
	/>

	<div class="options">
		{#each options, i (i)}
			<div class="option-row">
				<input
					type="text"
					placeholder="Option {i + 1}"
					bind:value={options[i]}
					maxlength={OPTION_MAX}
					aria-label="Option {i + 1}"
				/>
				{#if options.length > OPTIONS_MIN}
					<button
						type="button"
						class="remove"
						onclick={() => removeOption(i)}
						aria-label="Remove option {i + 1}">✕</button
					>
				{/if}
			</div>
		{/each}
		{#if options.length < OPTIONS_MAX}
			<button type="button" class="btn btn-secondary btn-small" onclick={addOption}>
				+ Add option
			</button>
		{/if}
	</div>

	<button
		type="button"
		class="settings-toggle"
		onclick={() => (showSettings = !showSettings)}
		aria-expanded={showSettings}
	>
		Settings {showSettings ? '▴' : '▾'}
	</button>

	{#if showSettings}
		<div class="card settings">
			<label class="row">
				<span>
					Anonymous votes
					<small>No names collected, ever</small>
				</span>
				<input type="checkbox" bind:checked={isAnonymous} />
			</label>

			<label class="row">
				<span>
					Multiple selections
					<small>Voters can pick more than one option</small>
				</span>
				<input type="checkbox" bind:checked={allowMulti} />
			</label>

			<label class="row">
				<span>
					Voters can add options
					<small>Write-ins show up in the poll for everyone</small>
				</span>
				<input type="checkbox" bind:checked={allowWritein} />
			</label>

			<label class="row">
				<span>
					Results
					<small>When voters see the tally</small>
				</span>
				<select bind:value={resultsVisibility}>
					<option value="live">Live</option>
					<option value="after_close">After poll closes</option>
				</select>
			</label>

			<label class="row">
				<span>
					Expires
					<small>Poll closes, then self-destructs 24h later</small>
				</span>
				<select bind:value={expiry}>
					{#each Object.keys(EXPIRY_CHOICES) as key (key)}
						<option value={key}>{key}</option>
					{/each}
				</select>
			</label>

			<div class="row geo-row">
				<span>
					Only people nearby can vote
					<small
						>Voters must be within a radius of where you are now. Their location is checked once and
						never stored.</small
					>
				</span>
				<input
					type="checkbox"
					checked={geofenceOn}
					onclick={(e) => {
						e.preventDefault();
						toggleGeofence();
					}}
					disabled={locating}
					aria-label="Limit voting to people nearby"
				/>
			</div>

			{#if locating}
				<p class="muted">Getting your location…</p>
			{/if}
			{#if geoError}
				<p class="error-text">{geoError}</p>
			{/if}

			{#if geofenceOn && coords}
				<div class="radius-picker">
					{#each RADII_M as r (r)}
						<button
							type="button"
							class="chip"
							class:active={radiusM === r}
							onclick={() => (radiusM = r)}
						>
							{radiusLabel(r)}
						</button>
					{/each}
				</div>
				{#if mapView}
					<div class="map-preview">
						<div
							class="map-grid"
							style="left: {mapView.leftPct}%; top: {mapView.topPct}%"
							aria-hidden="true"
						>
							{#each mapView.tiles as tile (tile)}
								<img src={tile} alt="" width="256" height="256" />
							{/each}
						</div>
						<svg class="map-overlay" viewBox="0 0 256 192" aria-hidden="true">
							<circle class="radius-ring" cx="128" cy="96" r={mapView.rPx} />
							<circle class="you-dot" cx="128" cy="96" r="6" />
						</svg>
						<a
							class="map-attrib"
							href="https://www.openstreetmap.org/copyright"
							target="_blank"
							rel="noopener noreferrer">© OpenStreetMap</a
						>
					</div>
					<p class="muted map-caption">
						Voting limited to about {radiusLabel(radiusM)} around here.
					</p>
				{/if}
			{/if}
		</div>
	{/if}

	{#if submitError}
		<p class="error-text">{submitError}</p>
	{/if}

	<button type="submit" class="btn create-btn" disabled={!canSubmit}>
		{submitting ? 'Creating…' : 'Create poll'}
	</button>
</form>

<form class="join" onsubmit={join}>
	<h2 class="join-title">Have a 4-letter code?</h2>
	<div class="join-row">
		<input
			type="text"
			placeholder="ABCD"
			bind:value={joinCode}
			maxlength="4"
			autocapitalize="characters"
			autocomplete="off"
			spellcheck="false"
			aria-label="Poll code"
		/>
		<button type="submit" class="btn btn-secondary btn-small">Go</button>
	</div>
</form>

<style>
	.options {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 12px;
	}

	.option-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.remove {
		flex: 0 0 auto;
		width: 40px;
		height: 40px;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 1rem;
	}

	.settings-toggle {
		margin-top: 16px;
		background: none;
		border: none;
		color: var(--text-muted);
		font-weight: 600;
		cursor: pointer;
		padding: 8px 0;
	}

	.settings {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-top: 4px;
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}

	.row span {
		display: flex;
		flex-direction: column;
		font-weight: 600;
		font-size: 0.95rem;
	}

	.row small {
		font-weight: 400;
		color: var(--text-muted);
	}

	.row input[type='checkbox'] {
		width: 22px;
		height: 22px;
		accent-color: var(--accent);
		flex: 0 0 auto;
	}

	.row select {
		padding: 8px 10px;
		border-radius: 8px;
		border: 1.5px solid var(--border);
		background: var(--surface);
	}

	.radius-picker {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.map-caption {
		text-align: center;
	}

	.map-preview {
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 3;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--border);
	}

	/* 3×3 tile canvas: 384 design units on both axes over a 256×192 viewport */
	.map-grid {
		position: absolute;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		width: 150%;
		height: 200%;
	}

	.map-grid img {
		display: block;
		width: 100%;
		height: 100%;
	}

	.map-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.radius-ring {
		fill: color-mix(in srgb, var(--accent) 18%, transparent);
		stroke: var(--accent);
		stroke-width: 2;
	}

	.you-dot {
		fill: var(--accent);
		stroke: #fff;
		stroke-width: 2.5;
		filter: drop-shadow(0 1px 2px rgba(28, 25, 23, 0.4));
	}

	.map-attrib {
		position: absolute;
		right: 4px;
		bottom: 4px;
		padding: 3px 6px;
		border-radius: 999px;
		font-size: 0.65rem;
		line-height: 1;
		background: color-mix(in srgb, var(--surface) 85%, transparent);
		color: var(--text);
		text-decoration: none;
	}

	.create-btn {
		margin-top: 16px;
	}

	.join {
		margin-top: 36px;
		padding-top: 20px;
		border-top: 1px solid var(--border);
	}

	.join-title {
		font-size: 1.15rem;
		line-height: 1.2;
		margin: 0 0 12px;
	}

	.join-row {
		display: flex;
		gap: 8px;
	}

	.join-row input {
		text-transform: uppercase;
		letter-spacing: 0.35em;
		font-weight: 700;
		text-align: center;
		flex: 1;
		min-width: 0;
	}
</style>
