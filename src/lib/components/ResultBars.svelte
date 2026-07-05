<script lang="ts">
	import type { PollOptionView } from '$lib/types';

	let {
		options,
		counts,
		total,
		myOptionIds = []
	}: {
		options: PollOptionView[];
		counts: Record<string, number>;
		total: number;
		myOptionIds?: number[];
	} = $props();

	function count(id: number): number {
		return counts[String(id)] ?? 0;
	}

	function pct(id: number): number {
		if (total === 0) return 0;
		return Math.round((count(id) / total) * 100);
	}

	const leader = $derived(Math.max(0, ...options.map((o) => count(o.id))));
</script>

<ul class="results" aria-live="polite">
	{#each options as option (option.id)}
		<li>
			<div class="labels">
				<span class="label">
					{option.label}
					{#if myOptionIds.includes(option.id)}<span class="mine" title="Your vote">✓ you</span>{/if}
				</span>
				<span class="nums">{count(option.id)} · {pct(option.id)}%</span>
			</div>
			<div class="track">
				<div
					class="bar"
					class:leader={count(option.id) === leader && leader > 0}
					style="width: {pct(option.id)}%"
				></div>
			</div>
		</li>
	{/each}
</ul>
<p class="muted total">{total} {total === 1 ? 'vote' : 'votes'}</p>

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
		color: var(--accent);
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

	.track {
		height: 14px;
		border-radius: 999px;
		background: var(--border);
		overflow: hidden;
	}

	.bar {
		height: 100%;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 55%, #f5c8b5);
		transition: width 400ms cubic-bezier(0.22, 1, 0.36, 1);
		min-width: 0;
	}

	.bar.leader {
		background: var(--accent);
	}

	.total {
		margin: 14px 0 0;
	}
</style>
