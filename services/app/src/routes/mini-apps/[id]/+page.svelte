<script>
	import { page } from '$app/stores';
	import { getMiniAppById } from '$lib/mini-apps.js';
	import { onMount } from 'svelte';

	/**
	 * @type {{id: string, name: string, description: string, source: string} | null}
	 */
	let app = null;
	let loading = true;
	/** @type {string | null} */
	let error = null;
	/** @type {HTMLIFrameElement | null} */
	let iframeRef = null;

	$: appId = $page.params.id;
	$: {
		if (appId) {
			const foundApp = getMiniAppById(appId);
			if (foundApp) {
				app = foundApp;
			} else {
				app = null;
				error = `Mini app "${appId}" not found`;
				loading = false;
			}
		}
	}

	onMount(() => {
		if (app) {
			// Set loading to false once iframe loads
			if (iframeRef) {
				iframeRef.addEventListener('load', () => {
					loading = false;
				});
				iframeRef.addEventListener('error', () => {
					error = 'Failed to load mini app';
					loading = false;
				});
			}
		}
	});
</script>

<div
	class="flex h-screen flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
>
	<div
		class="relative z-10 border-b border-white/10 bg-slate-900/60 px-6 py-[calc(1rem+env(safe-area-inset-top))] pb-4 backdrop-blur-[20px] backdrop-saturate-[180%]"
	>
		{#if app}
			<h1 class="m-0 text-center text-2xl font-semibold tracking-tight text-white/95">
				{app.name}
			</h1>
		{/if}
	</div>

	<div class="relative flex-1 overflow-hidden">
		{#if error}
			<div
				class="absolute top-1/2 left-1/2 z-[5] -translate-x-1/2 -translate-y-1/2 text-center text-yellow-400"
			>
				<p class="m-0 text-base">{error}</p>
			</div>
		{:else if app}
			{#if loading}
				<div
					class="absolute top-1/2 left-1/2 z-[5] -translate-x-1/2 -translate-y-1/2 text-center text-white/70"
				>
					<div
						class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-white/10 border-t-cyan-400"
					></div>
					<p class="m-0 text-[0.95rem] text-white/60">Loading {app.name}...</p>
				</div>
			{/if}
			<iframe
				bind:this={iframeRef}
				src={app.source}
				class="h-full w-full border-0 bg-white"
				sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
				title={app.name}
			></iframe>
		{/if}
	</div>
</div>
