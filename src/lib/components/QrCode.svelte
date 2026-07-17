<script lang="ts">
	import QRCode from 'qrcode';

	let { text, size = 320 }: { text: string; size?: number } = $props();

	let dataUrl = $state('');

	$effect(() => {
		QRCode.toDataURL(text, {
			width: size,
			margin: 2,
			errorCorrectionLevel: 'M',
			color: { dark: '#1c1917', light: '#ffffff' }
		})
			.then((url) => (dataUrl = url))
			.catch(() => (dataUrl = ''));
	});
</script>

{#if dataUrl}
	<img class="qr" src={dataUrl} alt="QR code linking to this poll" width={size} height={size} />
{/if}

<style>
	.qr {
		display: block;
		width: 100%;
		max-width: 320px;
		height: auto;
		border-radius: 12px;
		border: 1px solid var(--border);
		background: #fff;
	}
</style>
