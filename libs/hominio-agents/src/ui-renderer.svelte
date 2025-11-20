<!--
	UI Renderer Component
	Dynamically loads and renders function UI components
-->
<script>
	import { onMount } from 'svelte';
	
	let { 
		functionId,
		resultData,
		onClose
	} = $props();
	
	let Component = $state(null);
	let loading = $state(true);
	let error = $state(null);
	
	onMount(async () => {
		try {
			// Use function loader to get the UI component loader
			const { loadFunction } = await import('./function-loader.js');
			const functionImpl = await loadFunction(functionId);
			
			if (!functionImpl.uiComponent) {
				throw new Error(`Function ${functionId} does not export uiComponent`);
			}
			
			// Load the actual Svelte component
			const componentModule = await functionImpl.uiComponent();
			Component = componentModule.default;
			loading = false;
		} catch (err) {
			console.error('[UIRenderer] Failed to load UI component:', err);
			error = err.message || 'Failed to load UI component';
			loading = false;
		}
	});
</script>

{#if loading}
	<div class="flex items-center justify-center p-8">
		<div class="text-sm text-slate-500">Loading...</div>
	</div>
{:else if error}
	<div class="p-6">
		<div class="text-sm text-red-600">Error: {error}</div>
	</div>
{:else if Component}
	<svelte:component this={Component} data={resultData} onClose={onClose} />
{/if}

