<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ResultBars from '$lib/components/ResultBars.svelte';
	import SharePanel from '$lib/components/SharePanel.svelte';
	import type { ResultsView } from '$lib/types';
	import { NAME_MAX, RADII_M } from '$lib/validation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const poll = $derived(data.poll);

	let results = $state<ResultsView>(data.results);
	let myOptionIds = $state<number[]>(data.myVote?.optionIds ?? []);
	let hasVoted = $state(data.myVote !== null);
	let editingVote = $state(false);

	let selected = $state<number[]>(data.myVote?.optionIds ?? []);
	let displayName = $state(data.myVote?.displayName ?? '');
	let voteError = $state('');
	let rejection = $state<{ distanceM: number; radiusM: number } | null>(null);
	let submitting = $state(false);
	let locating = $state(false);
	let geoDenied = $state(false);

	let showShare = $state(false);
	let closing = $state(false);

	const status = $derived(results.status);
	const showVoteForm = $derived(status === 'open' && (!hasVoted || editingVote));
	const resultsHidden = $derived(results.counts === null);

	// --- countdown ---------------------------------------------------------
	let clockOffset = data.serverNow - Math.floor(Date.now() / 1000);
	let nowTick = $state(Math.floor(Date.now() / 1000));
	const secondsLeft = $derived(Math.max(0, results.closesAt - (nowTick + clockOffset)));

	function fmtCountdown(s: number): string {
		if (s >= 86400) return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
		if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
		if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
		return `${s}s`;
	}

	// --- live updates: SSE with polling fallback ---------------------------
	onMount(() => {
		if (page.url.searchParams.get('new') === '1') {
			showShare = true;
			// strip the flag so refresh/back doesn't reopen
			goto(resolve('/p/[id]', { id: poll.id }), {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});
		}

		const saved = localStorage.getItem('soh_name');
		if (saved && !displayName) displayName = saved;

		const tick = setInterval(() => (nowTick = Math.floor(Date.now() / 1000)), 1000);

		let es: EventSource | null = null;
		let pollTimer: ReturnType<typeof setInterval> | null = null;
		let sseErrors = 0;
		let stopped = false;

		const applyPayload = (payload: ResultsView) => {
			results = payload;
			clockOffset = payload.serverNow - Math.floor(Date.now() / 1000);
		};

		const startPolling = () => {
			if (pollTimer || stopped) return;
			pollTimer = setInterval(async () => {
				try {
					const res = await fetch(`/api/polls/${poll.id}/results`);
					if (res.status === 404) {
						stop();
						return;
					}
					if (res.ok) applyPayload(await res.json());
				} catch {
					// transient network error; keep polling
				}
			}, 3000);
		};

		const startSse = () => {
			if (stopped) return;
			es = new EventSource(`/api/polls/${poll.id}/stream`);
			es.onmessage = (event) => {
				sseErrors = 0;
				try {
					applyPayload(JSON.parse(event.data));
				} catch {
					// malformed frame; ignore
				}
			};
			es.onerror = () => {
				sseErrors += 1;
				if (sseErrors >= 2) {
					es?.close();
					es = null;
					startPolling();
				}
			};
		};

		const stop = () => {
			stopped = true;
			es?.close();
			if (pollTimer) clearInterval(pollTimer);
		};

		startSse();

		return () => {
			clearInterval(tick);
			stop();
		};
	});

	// --- voting -------------------------------------------------------------
	function toggleOption(id: number) {
		if (poll.allowMulti) {
			selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
		} else {
			selected = [id];
		}
	}

	function getPosition(): Promise<GeolocationPosition> {
		return new Promise((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject, {
				enableHighAccuracy: true,
				timeout: 15000,
				maximumAge: 30000
			});
		});
	}

	async function submitVote() {
		if (selected.length === 0 || submitting) return;
		voteError = '';
		rejection = null;
		submitting = true;

		const body: Record<string, unknown> = { optionIds: selected };

		if (!poll.isAnonymous) {
			const name = displayName.trim();
			if (!name) {
				voteError = 'Enter your name to vote on this poll.';
				submitting = false;
				return;
			}
			body.displayName = name;
			localStorage.setItem('soh_name', name);
		}

		if (poll.geofenced) {
			if (!('geolocation' in navigator)) {
				voteError = 'This poll needs your location, but your browser does not support it.';
				submitting = false;
				return;
			}
			locating = true;
			try {
				const pos = await getPosition();
				body.lat = pos.coords.latitude;
				body.lng = pos.coords.longitude;
				body.accuracy = pos.coords.accuracy;
			} catch {
				geoDenied = true;
				locating = false;
				submitting = false;
				return;
			}
			locating = false;
		}

		try {
			const res = await fetch(`/api/polls/${poll.id}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data = await res.json();
			if (!res.ok) {
				if (res.status === 403 && typeof data.distanceM === 'number') {
					rejection = { distanceM: data.distanceM, radiusM: data.radiusM };
				} else if (res.status === 409) {
					voteError = 'This poll just closed.';
					await invalidateAll();
				} else {
					voteError = data.error ?? 'Vote failed. Try again.';
				}
				submitting = false;
				return;
			}
			results = data.results;
			myOptionIds = [...selected];
			hasVoted = true;
			editingVote = false;
		} catch {
			voteError = 'Network error. Try again.';
		}
		submitting = false;
	}

	// --- creator actions -----------------------------------------------------
	async function closeNow() {
		if (closing) return;
		if (!confirm('Close this poll now? Votes will be frozen.')) return;
		closing = true;
		const res = await fetch(`/api/polls/${poll.id}/close`, { method: 'POST' });
		if (res.ok) {
			const snap = await fetch(`/api/polls/${poll.id}/results`);
			if (snap.ok) results = await snap.json();
		}
		closing = false;
	}

	async function deleteNow() {
		if (!confirm('Delete this poll and all its votes immediately? This cannot be undone.')) return;
		const res = await fetch(`/api/polls/${poll.id}`, { method: 'DELETE' });
		if (res.ok) goto(resolve('/'));
	}

	async function bumpRadius(r: number) {
		await fetch(`/api/polls/${poll.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ radiusM: r })
		});
		await invalidateAll();
	}

	function fmtDistance(m: number): string {
		return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
	}
</script>

<svelte:head>
	<title>{poll.question} — Show of Hands</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<h1>{poll.question}</h1>

<p class="meta muted">
	{#if status === 'open'}
		{#if secondsLeft > 0}Closes in {fmtCountdown(secondsLeft)}{:else}Closing…{/if}
		{#if poll.geofenced}
			· 📍 within {poll.geofenceRadiusM && poll.geofenceRadiusM >= 1000
				? `${poll.geofenceRadiusM / 1000} km`
				: `${poll.geofenceRadiusM} m`}
		{/if}
		{#if !poll.isAnonymous}· names shown{/if}
	{:else}
		Poll closed · final results
	{/if}
</p>

{#if data.isCreator}
	<div class="creator-bar">
		<button
			type="button"
			class="btn btn-secondary btn-small"
			onclick={() => (showShare = !showShare)}
		>
			{showShare ? 'Hide sharing' : 'Share poll'}
		</button>
		{#if status === 'open'}
			<button
				type="button"
				class="btn btn-secondary btn-small"
				onclick={closeNow}
				disabled={closing}
			>
				Close now
			</button>
		{/if}
		<button type="button" class="btn btn-danger btn-small" onclick={deleteNow}>Delete</button>
	</div>
	{#if status === 'open' && poll.geofenced}
		<details class="radius-bump">
			<summary class="muted">Friends getting rejected? Widen the radius</summary>
			<div class="radius-options">
				{#each RADII_M as r (r)}
					<button
						type="button"
						class="chip"
						class:active={poll.geofenceRadiusM === r}
						onclick={() => bumpRadius(r)}
					>
						{r >= 1000 ? `${r / 1000} km` : `${r} m`}
					</button>
				{/each}
			</div>
		</details>
	{/if}
{/if}

{#if showShare}
	<div class="share-wrap">
		<SharePanel pollId={poll.id} question={poll.question} />
	</div>
{/if}

{#if geoDenied}
	<div class="card notice">
		<h2>Location needed</h2>
		<p>
			This poll is limited to people near its creator. Your location is checked once to verify
			you're nearby and <strong>never stored</strong>.
		</p>
		<p class="muted">
			Allow location access in your browser settings and try again. On a desktop without GPS, try
			your phone instead.
		</p>
		<button type="button" class="btn btn-secondary" onclick={() => (geoDenied = false)}>
			Try again
		</button>
	</div>
{:else if rejection}
	<div class="card notice">
		<h2>You're too far away</h2>
		<p>
			You appear to be ~{fmtDistance(rejection.distanceM)} away; this poll is limited to
			{fmtDistance(rejection.radiusM)} around its creator.
		</p>
		<p class="muted">If you think this is wrong, ask the creator to widen the radius.</p>
		<button type="button" class="btn btn-secondary" onclick={() => (rejection = null)}>Back</button>
	</div>
{:else if showVoteForm}
	<div class="vote-form">
		{#if poll.geofenced}
			<p class="muted geo-note">
				📍 This poll is limited to people near its creator. Your location is checked once when you
				vote and never stored.
			</p>
		{/if}

		<div class="choices" role={poll.allowMulti ? 'group' : 'radiogroup'} aria-label="Poll options">
			{#each poll.options as option (option.id)}
				<button
					type="button"
					class="choice"
					class:selected={selected.includes(option.id)}
					role={poll.allowMulti ? 'checkbox' : 'radio'}
					aria-checked={selected.includes(option.id)}
					onclick={() => toggleOption(option.id)}
				>
					<span class="check" aria-hidden="true">{selected.includes(option.id) ? '●' : '○'}</span>
					{option.label}
				</button>
			{/each}
		</div>
		{#if poll.allowMulti}
			<p class="muted">Pick as many as you like.</p>
		{/if}

		{#if !poll.isAnonymous}
			<input
				type="text"
				class="name-input"
				placeholder="Your name"
				bind:value={displayName}
				maxlength={NAME_MAX}
				autocomplete="name"
				aria-label="Your display name"
			/>
		{/if}

		{#if voteError}
			<p class="error-text">{voteError}</p>
		{/if}

		<button
			type="button"
			class="btn vote-btn"
			onclick={submitVote}
			disabled={selected.length === 0 || submitting}
		>
			{#if locating}Checking location…{:else if submitting}Voting…{:else if editingVote}Update vote{:else}Vote{/if}
		</button>
		{#if editingVote}
			<button type="button" class="btn btn-secondary" onclick={() => (editingVote = false)}>
				Cancel
			</button>
		{/if}
	</div>
{:else if resultsHidden}
	<div class="card notice">
		<h2>{results.total} {results.total === 1 ? 'vote' : 'votes'} so far</h2>
		<p class="muted">Results will be revealed when the poll closes.</p>
		{#if hasVoted && status === 'open'}
			<button type="button" class="btn btn-secondary" onclick={() => (editingVote = true)}>
				Change my vote
			</button>
		{/if}
	</div>
{:else}
	<div class="results-wrap">
		{#if !hasVoted && status === 'open'}
			<p class="muted">You haven't voted yet.</p>
			<button type="button" class="btn" onclick={() => (editingVote = true)}>Vote</button>
		{/if}

		<ResultBars
			options={poll.options}
			counts={results.counts ?? {}}
			total={results.total}
			{myOptionIds}
		/>

		{#if hasVoted && status === 'open'}
			<button
				type="button"
				class="btn btn-secondary change-btn"
				onclick={() => {
					selected = [...myOptionIds];
					editingVote = true;
				}}
			>
				Change my vote
			</button>
		{/if}

		{#if results.voters && results.voters.length > 0}
			<div class="voters">
				<h2>Who voted</h2>
				<p>{results.voters.join(', ')}</p>
			</div>
		{/if}
	</div>
{/if}

<style>
	.meta {
		margin: -4px 0 16px;
	}

	.creator-bar {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}

	.radius-bump {
		margin-bottom: 12px;
	}

	.radius-options {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		padding-top: 8px;
	}

	.share-wrap {
		margin-bottom: 16px;
	}

	.choices {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.choice {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		text-align: left;
		padding: 15px 16px;
		border-radius: 12px;
		border: 1.5px solid var(--border);
		background: var(--surface);
		font-size: 1.05rem;
		font-weight: 600;
		cursor: pointer;
		overflow-wrap: anywhere;
	}

	.choice.selected {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.check {
		color: var(--accent);
		flex: 0 0 auto;
	}

	.name-input {
		margin-top: 14px;
	}

	.vote-btn {
		margin-top: 16px;
	}

	.geo-note {
		margin: 0 0 12px;
	}

	.notice {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.notice h2 {
		margin: 0;
		font-size: 1.15rem;
	}

	.notice p {
		margin: 0;
	}

	.change-btn {
		margin-top: 16px;
	}

	.voters {
		margin-top: 20px;
		padding-top: 14px;
		border-top: 1px solid var(--border);
	}

	.voters h2 {
		font-size: 0.95rem;
		margin: 0 0 6px;
		color: var(--text-muted);
	}

	.voters p {
		margin: 0;
		overflow-wrap: anywhere;
	}
</style>
