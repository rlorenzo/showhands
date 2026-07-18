<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import CreatorControls from '$lib/components/CreatorControls.svelte';
	import PollResults from '$lib/components/PollResults.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import SharePanel from '$lib/components/SharePanel.svelte';
	import VoteForm from '$lib/components/VoteForm.svelte';
	import type { ResultsView } from '$lib/types';
	import { WRITEIN_TOTAL_MAX } from '$lib/validation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const poll = $derived(data.poll);

	// Seeded from the server load, then owned locally — SSE, vote responses and
	// the results snapshot drive them from here on, so a reload must not clobber
	// what the voter is currently doing.
	let results = $state<ResultsView>(untrack(() => data.results));
	let myOptionIds = $state<number[]>(untrack(() => data.myVote?.optionIds ?? []));
	let hasVoted = $state(untrack(() => data.myVote !== null));
	let editingVote = $state(false);

	let selected = $state<number[]>(untrack(() => data.myVote?.optionIds ?? []));
	let writeIn = $state('');
	let displayName = $state(untrack(() => data.myVote?.displayName ?? ''));
	let voteError = $state('');
	let rejection = $state<{ distanceM: number; radiusM: number } | null>(null);
	let submitting = $state(false);
	let locating = $state(false);
	let geoDenied = $state(false);

	let showShare = $state(false);
	let justVoted = $state(false);

	const status = $derived(results.status);
	const showVoteForm = $derived(status === 'open' && (!hasVoted || editingVote));
	const resultsHidden = $derived(results.counts === null);
	// Write-in polls grow their option list while open; the results payload is
	// the live source of truth, the load-time poll view just the seed.
	const liveOptions = $derived(results.options ?? poll.options);
	const writeInFull = $derived(liveOptions.length >= WRITEIN_TOTAL_MAX);
	// Once the poll is full the write-in field is hidden, so a pending write-in
	// must not keep the Vote button live or be submitted (it would 409). The text
	// is kept, not cleared, so it returns usable if an option is later removed.
	const canVote = $derived(selected.length > 0 || (!writeInFull && writeIn.trim().length > 0));

	// The creator can remove options mid-poll; drop any local reference to an
	// option that no longer exists. If this device's entire vote was on it,
	// hand the vote form back so the voter can pick again.
	$effect(() => {
		const valid = new Set(liveOptions.map((o) => o.id));
		if (selected.some((id) => !valid.has(id))) {
			selected = selected.filter((id) => valid.has(id));
		}
		if (myOptionIds.some((id) => !valid.has(id))) {
			myOptionIds = myOptionIds.filter((id) => valid.has(id));
			if (hasVoted && myOptionIds.length === 0) {
				hasVoted = false;
				justVoted = false;
			}
		}
	});

	// --- countdown ---------------------------------------------------------
	let clockOffset = untrack(() => data.serverNow) - Math.floor(Date.now() / 1000);
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
			writeIn = '';
		}
	}

	// On single-choice polls a write-in IS the choice, so typing deselects.
	function onWriteInInput() {
		if (!poll.allowMulti && writeIn.trim().length > 0) selected = [];
	}

	function getPosition(): Promise<GeolocationPosition> {
		return new Promise((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject, {
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 60000
			});
		});
	}

	// Assemble the vote request body. Returns null (with voteError set) when a
	// required name is missing on a named poll.
	function buildVoteBody(): Record<string, unknown> | null {
		const body: Record<string, unknown> = { optionIds: selected };
		if (poll.allowWritein && !writeInFull && writeIn.trim()) body.writeIn = writeIn.trim();
		if (!poll.isAnonymous) {
			const name = displayName.trim();
			if (!name) {
				voteError = 'Enter your name to vote on this poll.';
				return null;
			}
			body.displayName = name;
			localStorage.setItem('soh_name', name);
		}
		return body;
	}

	// Attach the voter's coordinates for geofenced polls. Returns false (with UI
	// state set) when location is unsupported or denied.
	async function attachLocation(body: Record<string, unknown>): Promise<boolean> {
		if (!poll.geofenced) return true;
		if (!('geolocation' in navigator)) {
			voteError = 'This poll needs your location, but your browser does not support it.';
			return false;
		}
		locating = true;
		try {
			const pos = await getPosition();
			body.lat = pos.coords.latitude;
			body.lng = pos.coords.longitude;
			body.accuracy = pos.coords.accuracy;
			return true;
		} catch {
			geoDenied = true;
			return false;
		} finally {
			locating = false;
		}
	}

	// Map a failed vote response to the right UI state.
	async function handleVoteFailure(
		res: Response,
		data: { error?: string; distanceM?: number; radiusM?: number }
	): Promise<void> {
		if (
			res.status === 403 &&
			typeof data.distanceM === 'number' &&
			typeof data.radiusM === 'number'
		) {
			rejection = { distanceM: data.distanceM, radiusM: data.radiusM };
			return;
		}
		if (res.status === 409) {
			// 409 is overloaded: a closed poll vs a write-in hitting the option cap.
			// Branch on the x-reason header rather than the message text.
			voteError =
				res.headers.get('x-reason') === 'writein-full'
					? (data.error ?? `This poll hit its ${WRITEIN_TOTAL_MAX}-option limit.`)
					: 'This poll just closed.';
			const snap = await fetch(`/api/polls/${poll.id}/results`);
			if (snap.ok) results = await snap.json();
			return;
		}
		voteError = data.error ?? 'Vote failed. Try again.';
	}

	async function submitVote() {
		if (!canVote || submitting) return;
		voteError = '';
		rejection = null;
		submitting = true;

		const body = buildVoteBody();
		if (!body || !(await attachLocation(body))) {
			submitting = false;
			return;
		}

		try {
			const res = await fetch(`/api/polls/${poll.id}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data = await res.json();
			if (res.ok) {
				results = data.results;
				// The server echoes the recorded ids — a write-in's id is only known there.
				myOptionIds = Array.isArray(data.optionIds) ? data.optionIds : [...selected];
				selected = [...myOptionIds];
				writeIn = '';
				hasVoted = true;
				editingVote = false;
				justVoted = true;
			} else {
				await handleVoteFailure(res, data);
			}
		} catch {
			voteError = 'Network error. Try again.';
		}
		submitting = false;
	}

	function fmtDistance(m: number): string {
		return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
	}
</script>

<!-- Generic, question-free social card by design: the poll question stays out
	of third-party unfurl caches (Slack, iMessage) via socialTitle, which keeps
	the ephemerality promise and adds no enumeration signal - missing and expired
	polls 404 alike. The question stays in the document <title> (local history). -->
<Seo
	title="{poll.question} - Show of Hands"
	socialTitle="Vote now · Show of Hands"
	description="Someone started a poll. Tap to cast your vote and watch the results land live. No account needed."
	noindex
/>

<h1>{poll.question}</h1>

<p class="meta muted">
	{#if status === 'open'}
		{#if secondsLeft > 0}<strong class="countdown">Closes in {fmtCountdown(secondsLeft)}</strong>
			· then it self-destructs{:else}Closing…{/if}
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
	<CreatorControls {poll} {status} {liveOptions} bind:showShare onResults={(r) => (results = r)} />
{/if}

{#if showShare}
	<div class="share-wrap">
		<SharePanel pollId={poll.id} question={poll.question} />
	</div>
{/if}

{#if geoDenied}
	<div class="card notice" role="alert">
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
	<div class="card notice" role="alert">
		<h2>You're too far away</h2>
		<p>
			You appear to be ~{fmtDistance(rejection.distanceM)} away; this poll is limited to
			{fmtDistance(rejection.radiusM)} around its creator.
		</p>
		<p class="muted">If you think this is wrong, ask the creator to widen the radius.</p>
		<button type="button" class="btn btn-secondary" onclick={() => (rejection = null)}>Back</button>
	</div>
{:else if showVoteForm}
	<VoteForm
		{poll}
		{liveOptions}
		{selected}
		bind:writeIn
		bind:displayName
		{writeInFull}
		{canVote}
		{voteError}
		{submitting}
		{locating}
		{editingVote}
		onToggle={toggleOption}
		{onWriteInInput}
		onSubmit={submitVote}
		onCancelEdit={() => (editingVote = false)}
	/>
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
	<PollResults
		{liveOptions}
		{results}
		{myOptionIds}
		{status}
		{hasVoted}
		{justVoted}
		onStartVote={() => (editingVote = true)}
		onChangeVote={() => {
			selected = [...myOptionIds];
			editingVote = true;
		}}
	/>
{/if}

<style>
	.meta {
		margin: -4px 0 16px;
	}

	.countdown {
		color: var(--text);
		font-weight: 600;
	}

	.share-wrap {
		margin-bottom: 16px;
		animation: rise-in 220ms var(--ease-out-quart) both;
	}

	.notice {
		display: flex;
		flex-direction: column;
		gap: 10px;
		animation: rise-in 220ms var(--ease-out-quart) both;
	}

	.notice h2 {
		margin: 0;
		font-size: 1.15rem;
	}

	.notice p {
		margin: 0;
	}
</style>
