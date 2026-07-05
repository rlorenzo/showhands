<script lang="ts">
	import QrCode from './QrCode.svelte';

	let { pollId, question }: { pollId: string; question: string } = $props();

	let copied = $state(false);
	// location is browser-only; guarded so an SSR render doesn't crash
	const shareUrl = $derived(
		typeof location !== 'undefined' ? `${location.origin}/p/${pollId}` : ''
	);

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// clipboard unavailable (http, old browser) — show the URL instead
			prompt('Copy this link:', shareUrl);
		}
	}

	async function nativeShare() {
		try {
			await navigator.share({ title: 'Show of Hands', text: question, url: shareUrl });
		} catch {
			// user cancelled or share unsupported — fall back to copy
			copyLink();
		}
	}

	const canNativeShare = $derived(
		typeof navigator !== 'undefined' && typeof navigator.share === 'function'
	);
</script>

<div class="share card">
	<p class="code" aria-label="Poll code">
		{#each pollId.split('') as ch, i (i)}<span>{ch}</span>{/each}
	</p>
	{#if shareUrl}
		<QrCode text={shareUrl} />
	{/if}
	<div class="buttons">
		<button type="button" class="btn btn-secondary" onclick={copyLink}>
			{copied ? '✓ Copied' : 'Copy link'}
		</button>
		{#if canNativeShare}
			<button type="button" class="btn" onclick={nativeShare}>Share</button>
		{/if}
	</div>
	<p class="muted">Scan the code or go to this page and enter the 4 letters.</p>
</div>

<style>
	.share {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		text-align: center;
	}

	.code {
		display: flex;
		gap: 10px;
		margin: 0;
		font-size: 2rem;
		font-weight: 800;
		letter-spacing: 0.05em;
	}

	.code span {
		background: var(--accent-soft);
		color: var(--accent-dark);
		border-radius: 10px;
		padding: 4px 12px;
	}

	.buttons {
		display: flex;
		gap: 10px;
		width: 100%;
	}

	.buttons .btn {
		flex: 1;
	}
</style>
