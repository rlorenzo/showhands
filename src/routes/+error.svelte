<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Not found - Show of Hands</title>
</svelte:head>

<div class="card wrap">
	{#if page.status === 404}
		<h1>Nothing here 🤷</h1>
		<p>
			This poll doesn't exist, or it expired and self-destructed. Polls delete themselves; that's
			the point.
		</p>
	{:else if page.status === 429}
		<h1>Slow down</h1>
		<p>{page.error?.message ?? 'Too many requests. Try again in a bit.'}</p>
	{:else}
		<h1>Something went wrong</h1>
		<p>{page.error?.message ?? 'Unexpected error.'}</p>
	{/if}
	<a class="btn" href={resolve('/')}>Create a poll</a>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 12px;
		text-align: center;
		align-items: center;
	}

	h1 {
		margin: 0;
	}

	p {
		margin: 0;
		color: var(--text-muted);
	}

	.btn {
		text-decoration: none;
		max-width: 240px;
	}
</style>
