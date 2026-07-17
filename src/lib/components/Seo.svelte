<script lang="ts">
	import { page } from '$app/state';

	type Props = {
		/** Document <title> (browser tab + history). Local only, never sent to
		 * unfurlers, so poll pages can safely keep the question here. */
		title: string;
		/** Social + meta description. Also emitted as the standard meta description. */
		description: string;
		/** og:title / twitter:title. Defaults to the document title; override to
		 * keep the title out of third-party link-preview caches (poll pages). */
		socialTitle?: string;
		/** Absolute or root-relative image path. Defaults to the branded card. */
		image?: string;
		imageAlt?: string;
		/** Emit robots noindex and skip the canonical link (conflicting signals). */
		noindex?: boolean;
	};

	let {
		title,
		description,
		socialTitle = title,
		image = '/og.png',
		imageAlt = 'Show of Hands: instant live polls, no accounts, self-destructing',
		noindex = false
	}: Props = $props();

	// adapter-node resolves url.origin from the ORIGIN env in production, so
	// these come out as the real https canonical/absolute URLs unfurlers need.
	const origin = $derived(page.url.origin);
	const canonical = $derived(origin + page.url.pathname);
	const imageUrl = $derived(
		image.startsWith('http') ? image : `${origin}${image.startsWith('/') ? '' : '/'}${image}`
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	{#if noindex}
		<meta name="robots" content="noindex" />
	{:else}
		<link rel="canonical" href={canonical} />
	{/if}

	<meta property="og:site_name" content="Show of Hands" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={socialTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={imageUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={imageAlt} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={socialTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={imageUrl} />
	<meta name="twitter:image:alt" content={imageAlt} />
</svelte:head>
