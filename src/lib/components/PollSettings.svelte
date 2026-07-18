<script lang="ts">
	import { EXPIRY_CHOICES, type ExpiryKey, RADII_M } from '$lib/validation';

	let {
		isAnonymous = $bindable(),
		allowMulti = $bindable(),
		allowWritein = $bindable(),
		resultsVisibility = $bindable(),
		expiry = $bindable(),
		geofenceOn = $bindable(),
		radiusM = $bindable(),
		coords = $bindable()
	}: {
		isAnonymous: boolean;
		allowMulti: boolean;
		allowWritein: boolean;
		resultsVisibility: 'live' | 'after_close';
		expiry: ExpiryKey;
		geofenceOn: boolean;
		radiusM: number;
		coords: { lat: number; lng: number; accuracy: number } | null;
	} = $props();

	let geoError = $state('');
	let locating = $state(false);

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
			[0, 1, 2].map((col) => `https://tile.openstreetmap.org/${z}/${wrap(x0 + col)}/${y0 + row}.png`)
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

	function radiusLabel(r: number): string {
		return r >= 1000 ? `${r / 1000} km` : `${r} m`;
	}
</script>

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

<style>
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
</style>
