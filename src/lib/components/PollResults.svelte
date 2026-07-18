<script lang="ts">
	import ResultBars from '$lib/components/ResultBars.svelte';
	import type { PollOptionView, ResultsView } from '$lib/types';

	let {
		liveOptions,
		results,
		myOptionIds,
		status,
		hasVoted,
		justVoted,
		onStartVote,
		onChangeVote
	}: {
		liveOptions: PollOptionView[];
		results: ResultsView;
		myOptionIds: number[];
		status: 'open' | 'closed';
		hasVoted: boolean;
		justVoted: boolean;
		onStartVote: () => void;
		onChangeVote: () => void;
	} = $props();
</script>

<div class="results-wrap">
	{#if justVoted && status === 'open'}
		<p class="voted-note" role="status">✋ Vote counted, you're in.</p>
	{/if}

	{#if !hasVoted && status === 'open'}
		<p class="muted">You haven't voted yet.</p>
		<button type="button" class="btn" onclick={onStartVote}>Vote</button>
	{/if}

	<ResultBars
		options={liveOptions}
		counts={results.counts ?? {}}
		total={results.total}
		{myOptionIds}
		closed={status !== 'open'}
	/>

	{#if hasVoted && status === 'open'}
		<button type="button" class="btn btn-secondary change-btn" onclick={onChangeVote}>
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

<style>
	.results-wrap {
		animation: rise-in 220ms var(--ease-out-quart) both;
	}

	.voted-note {
		margin: 0 0 12px;
		padding: 10px 14px;
		border-radius: 10px;
		background: var(--accent-soft);
		color: var(--accent-deeper);
		font-weight: 600;
		animation: rise-in 220ms var(--ease-out-quart);
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
