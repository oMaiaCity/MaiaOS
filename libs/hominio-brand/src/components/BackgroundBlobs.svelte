<script>
	/**
	 * BackgroundBlobs - Decorative background blobs for Liquid Glass effect
	 * @typedef {Object} Props
	 * @property {boolean} blue - Show blue blob (default: true)
	 * @property {boolean} purple - Show purple blob (default: true)
	 * @property {boolean} emerald - Show emerald blob (default: true)
	 */
	
	let { 
		blue = true,
		purple = true,
		emerald = true,
	} = $props();
</script>

{#if blue}
	<div class="fixed -top-[20%] -left-[10%] h-[500px] w-[500px] rounded-full bg-blue-200/20 blur-3xl filter pointer-events-none"></div>
{/if}
{#if purple}
	<div class="fixed top-[20%] -right-[10%] h-[600px] w-[600px] rounded-full bg-purple-200/20 blur-3xl filter pointer-events-none"></div>
{/if}
{#if emerald}
	<div class="fixed -bottom-[20%] left-[20%] h-[500px] w-[500px] rounded-full bg-emerald-200/20 blur-3xl filter pointer-events-none"></div>
{/if}

