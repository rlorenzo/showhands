<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PollSettings from '$lib/components/PollSettings.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import {
		DEFAULT_EXPIRY,
		type ExpiryKey,
		OPTION_MAX,
		OPTIONS_MAX,
		OPTIONS_MIN,
		QUESTION_MAX
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
						class="icon-btn"
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
		<PollSettings
			bind:isAnonymous
			bind:allowMulti
			bind:allowWritein
			bind:resultsVisibility
			bind:expiry
			bind:geofenceOn
			bind:radiusM
			bind:coords
		/>
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

	.settings-toggle {
		margin-top: 16px;
		background: none;
		border: none;
		color: var(--text-muted);
		font-weight: 600;
		cursor: pointer;
		padding: 8px 0;
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
