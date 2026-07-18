<script lang="ts">
	import type { PollOptionView, PollView } from '$lib/types';
	import { NAME_MAX, OPTION_MAX, WRITEIN_TOTAL_MAX } from '$lib/validation';

	let {
		poll,
		liveOptions,
		selected,
		writeIn = $bindable(),
		displayName = $bindable(),
		writeInFull,
		canVote,
		voteError,
		submitting,
		locating,
		editingVote,
		onToggle,
		onWriteInInput,
		onSubmit,
		onCancelEdit
	}: {
		poll: PollView;
		liveOptions: PollOptionView[];
		selected: number[];
		writeIn: string;
		displayName: string;
		writeInFull: boolean;
		canVote: boolean;
		voteError: string;
		submitting: boolean;
		locating: boolean;
		editingVote: boolean;
		onToggle: (id: number) => void;
		onWriteInInput: () => void;
		onSubmit: () => void;
		onCancelEdit: () => void;
	} = $props();
</script>

<div class="vote-form">
	{#if poll.geofenced}
		<p class="muted geo-note">
			📍 This poll is limited to people near its creator. Your location is checked once when you
			vote and never stored.
		</p>
	{/if}

	<div class="choices" role="group" aria-label="Poll options">
		{#each liveOptions as option (option.id)}
			<button
				type="button"
				class="choice"
				class:selected={selected.includes(option.id)}
				aria-pressed={selected.includes(option.id)}
				onclick={() => onToggle(option.id)}
			>
				<span class="check" aria-hidden="true">{selected.includes(option.id) ? '●' : '○'}</span>
				{option.label}
			</button>
		{/each}
	</div>
	{#if poll.allowWritein}
		{#if writeInFull}
			<p class="muted writein-note">This poll hit its {WRITEIN_TOTAL_MAX}-option limit.</p>
		{:else}
			<div class="writein" class:selected={writeIn.trim().length > 0}>
				<span class="check" aria-hidden="true">{writeIn.trim() ? '●' : '○'}</span>
				<input
					type="text"
					class="writein-input"
					placeholder={poll.allowMulti ? 'Add your own option' : 'Or write your own…'}
					bind:value={writeIn}
					oninput={onWriteInInput}
					maxlength={OPTION_MAX}
					aria-label="Write in your own option"
				/>
			</div>
		{/if}
	{/if}
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
		<p class="error-text" role="alert">{voteError}</p>
	{/if}

	<button type="button" class="btn vote-btn" onclick={onSubmit} disabled={!canVote || submitting}>
		{#if locating}Checking location…{:else if submitting}Voting…{:else if editingVote}Update vote{:else}Vote{/if}
	</button>
	{#if editingVote}
		<button type="button" class="btn btn-secondary" onclick={onCancelEdit}>Cancel</button>
	{/if}
</div>

<style>
	.vote-form {
		animation: rise-in 220ms var(--ease-out-quart) both;
	}

	.geo-note {
		margin: 0 0 12px;
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
		transition:
			background 150ms var(--ease-out-quart),
			border-color 150ms var(--ease-out-quart);
	}

	.choice.selected {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.check {
		color: var(--accent);
		flex: 0 0 auto;
	}

	/* The write-in row mirrors a .choice so it reads as one more way to raise
	   your hand, not a separate form. */
	.writein {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 10px;
		padding: 0 16px;
		border-radius: 12px;
		border: 1.5px solid var(--border);
		background: var(--surface);
		transition:
			background 150ms var(--ease-out-quart),
			border-color 150ms var(--ease-out-quart);
	}

	.writein.selected {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.writein-input {
		flex: 1;
		min-width: 0;
		padding: 15px 0;
		border: none;
		background: transparent;
		font-size: 1.05rem;
		font-weight: 600;
	}

	.writein-input:focus {
		outline: none;
	}

	.writein:focus-within {
		border-color: var(--accent);
	}

	.writein-note {
		margin: 10px 0 0;
	}

	.name-input {
		margin-top: 14px;
	}

	.vote-btn {
		margin-top: 16px;
	}
</style>
