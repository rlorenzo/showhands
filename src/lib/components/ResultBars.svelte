<script lang="ts">
	import type { PollOptionView } from '$lib/types';

	let {
		options,
		counts,
		total,
		myOptionIds = [],
		closed = false
	}: {
		options: PollOptionView[];
		counts: Record<string, number>;
		total: number;
		myOptionIds?: number[];
		closed?: boolean;
	} = $props();

	function count(id: number): number {
		return counts[String(id)] ?? 0;
	}

	function pct(id: number): number {
		if (total === 0) return 0;
		return Math.round((count(id) / total) * 100);
	}

	const leader = $derived(Math.max(0, ...options.map((o) => count(o.id))));

	function isWinner(id: number): boolean {
		return closed && leader > 0 && count(id) === leader;
	}
</script>

<ul class="results" class:closed>
	{#each options as option, i (option.id)}
		<li class:winner={isWinner(option.id)}>
			<div class="labels">
				<span class="label">
					{#if isWinner(option.id)}<span class="win-hand" aria-hidden="true">✋</span><span
							class="sr-only">Winner:</span
						>{/if}
					{option.label}
					{#if myOptionIds.includes(option.id)}<span class="mine" title="Your vote">✓ you</span
						>{/if}
				</span>
				<span class="nums">
					{#key `${count(option.id)}·${pct(option.id)}`}
						<span class="tick">{count(option.id)} · {pct(option.id)}%</span>
					{/key}
				</span>
			</div>
			<div class="track">
				<div
					class="bar"
					class:leader={count(option.id) === leader && leader > 0}
					style="--p: {pct(option.id) / 100}; --i: {i}"
				></div>
			</div>
		</li>
	{/each}
</ul>
<p class="muted total" aria-live="polite">{total} {total === 1 ? 'vote' : 'votes'}</p>

<style>
	.results {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.labels {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 4px;
		font-size: 0.95rem;
	}

	.label {
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.mine {
		color: var(--accent-dark);
		font-size: 0.8rem;
		font-weight: 700;
		margin-left: 6px;
		white-space: nowrap;
	}

	.nums {
		color: var(--text-muted);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.tick {
		display: inline-block;
		animation: tick-in 200ms var(--ease-out-quart);
	}

	.track {
		height: 14px;
		border-radius: 999px;
		background: var(--border);
		overflow: hidden;
	}

	/* The hand going up: bars scale in on reveal (staggered), then every new vote
	   lands as a weighted transform — never a layout animation. */
	.bar {
		height: 100%;
		width: 100%;
		border-radius: 999px;
		background: var(--accent-faded);
		transform: scaleX(var(--p, 0));
		transform-origin: left;
		transition:
			transform 400ms var(--ease-out-quint),
			background 250ms var(--ease-out-quart);
		animation: hand-up 500ms var(--ease-out-quint) backwards;
		animation-delay: calc(var(--i, 0) * 50ms);
	}

	.bar.leader {
		background: var(--accent);
	}

	.winner .label {
		font-weight: 800;
		font-size: 1.05rem;
	}

	.win-hand {
		margin-right: 4px;
	}

	.winner .track {
		animation: winner-glow 900ms var(--ease-out-quart) 450ms 1 backwards;
	}

	.closed li:not(.winner) .label {
		color: var(--text-muted);
	}

	.total {
		margin: 14px 0 0;
	}
</style>
