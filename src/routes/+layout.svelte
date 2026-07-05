<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content="#e85d2f" />
</svelte:head>

<div class="shell">
	<a class="brand" href="/"><span class="hand">✋</span> Show of Hands</a>
	<main>
		{@render children()}
	</main>
	<footer class="site-footer">
		<a href="/about">How it works &amp; privacy</a>
	</footer>
</div>
