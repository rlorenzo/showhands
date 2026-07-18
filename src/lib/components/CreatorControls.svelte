<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PollOptionView, PollView, ResultsView } from '$lib/types';
	import { OPTIONS_MIN, RADII_M } from '$lib/validation';

	let {
		poll,
		status,
		liveOptions,
		showShare = $bindable(),
		onResults
	}: {
		poll: PollView;
		status: 'open' | 'closed';
		liveOptions: PollOptionView[];
		showShare: boolean;
		onResults: (results: ResultsView) => void;
	} = $props();

	let confirmAction = $state<null | 'close' | 'delete'>(null);
	let confirmRemove = $state<{ id: number; label: string } | null>(null);
	let closing = $state(false);
	let removing = $state(false);
	let removeError = $state('');

	async function closeNow() {
		if (closing) return;
		closing = true;
		confirmAction = null;
		const res = await fetch(`/api/polls/${poll.id}/close`, { method: 'POST' });
		if (res.ok) {
			const snap = await fetch(`/api/polls/${poll.id}/results`);
			if (snap.ok) onResults(await snap.json());
		}
		closing = false;
	}

	async function deleteNow() {
		confirmAction = null;
		const res = await fetch(`/api/polls/${poll.id}`, { method: 'DELETE' });
		if (res.ok) goto(resolve('/'));
	}

	async function removeOption(id: number) {
		if (removing) return;
		removing = true;
		removeError = '';
		try {
			const res = await fetch(`/api/polls/${poll.id}/options/${id}`, { method: 'DELETE' });
			const data = await res.json();
			if (!res.ok) {
				removeError = data.error ?? 'Could not remove the option. Try again.';
			} else {
				onResults(data.results);
				confirmRemove = null;
			}
		} catch {
			removeError = 'Network error. Try again.';
		}
		removing = false;
	}

	async function bumpRadius(r: number) {
		await fetch(`/api/polls/${poll.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ radiusM: r })
		});
		await invalidateAll();
	}
</script>

<div class="creator-bar">
	<button type="button" class="btn btn-secondary btn-small" onclick={() => (showShare = !showShare)}>
		{showShare ? 'Hide sharing' : 'Share poll'}
	</button>
	{#if status === 'open'}
		<button
			type="button"
			class="btn btn-secondary btn-small"
			onclick={() => (confirmAction = confirmAction === 'close' ? null : 'close')}
			disabled={closing}
		>
			Close now
		</button>
	{/if}
	<button
		type="button"
		class="btn btn-danger btn-small"
		onclick={() => (confirmAction = confirmAction === 'delete' ? null : 'delete')}
	>
		Delete
	</button>
</div>
{#if confirmAction === 'close'}
	<div class="card confirm-card">
		<p><strong>Close this poll now?</strong> Voting stops and the tally becomes final.</p>
		<div class="confirm-row">
			<button type="button" class="btn btn-small" onclick={closeNow} disabled={closing}>
				Close poll
			</button>
			<button type="button" class="btn btn-secondary btn-small" onclick={() => (confirmAction = null)}>
				Cancel
			</button>
		</div>
	</div>
{:else if confirmAction === 'delete'}
	<div class="card confirm-card">
		<p><strong>Delete this poll and every vote?</strong> This cannot be undone.</p>
		<div class="confirm-row">
			<button type="button" class="btn btn-danger btn-small" onclick={deleteNow}>Delete now</button>
			<button type="button" class="btn btn-secondary btn-small" onclick={() => (confirmAction = null)}>
				Keep poll
			</button>
		</div>
	</div>
{/if}
{#if status === 'open' && liveOptions.length > OPTIONS_MIN}
	<details class="manage-options">
		<summary class="muted">Remove an option</summary>
		<ul class="option-list">
			{#each liveOptions as option (option.id)}
				<li>
					<span class="option-label">{option.label}</span>
					<button
						type="button"
						class="icon-btn"
						onclick={() => (confirmRemove = option)}
						aria-label="Remove option {option.label}">✕</button
					>
				</li>
			{/each}
		</ul>
		{#if removeError}
			<p class="error-text" role="alert">{removeError}</p>
		{/if}
	</details>
	{#if confirmRemove}
		{@const target = confirmRemove}
		<div class="card confirm-card">
			<p>
				<strong>Remove “{target.label}”?</strong> Its votes are deleted; anyone who picked it can vote
				again.
			</p>
			<div class="confirm-row">
				<button
					type="button"
					class="btn btn-danger btn-small"
					onclick={() => removeOption(target.id)}
					disabled={removing}
				>
					Remove option
				</button>
				<button type="button" class="btn btn-secondary btn-small" onclick={() => (confirmRemove = null)}>
					Keep it
				</button>
			</div>
		</div>
	{/if}
{/if}
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

<style>
	.creator-bar {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}

	.confirm-card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 12px;
		animation: rise-in 220ms var(--ease-out-quart);
	}

	.confirm-card p {
		margin: 0;
	}

	.confirm-row {
		display: flex;
		gap: 8px;
	}

	.radius-bump,
	.manage-options {
		margin-bottom: 12px;
	}

	.option-list {
		list-style: none;
		margin: 0;
		padding: 8px 0 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.option-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.option-label {
		overflow-wrap: anywhere;
	}

	.radius-options {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		padding-top: 8px;
	}
</style>
