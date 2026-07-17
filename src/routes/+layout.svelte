<script lang="ts">
	import '../app.css';
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content="#e85d2f" />
</svelte:head>

<div class="shell">
	<a class="brand" href={resolve('/')}>
		<img class="hand" src={favicon} alt="" width="22" height="22" />
		Show of Hands
	</a>
	<main>
		{@render children()}
	</main>
	<footer class="site-footer">
		<a href={resolve('/about')}>How it works &amp; privacy</a>
		<iframe
			class="sponsor-btn"
			src="https://github.com/sponsors/rlorenzo/button"
			title="Sponsor rlorenzo"
			height="32"
			width="114"
			loading="lazy"
		></iframe>
	</footer>
</div>
