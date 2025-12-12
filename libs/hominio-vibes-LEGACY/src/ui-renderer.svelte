<!--
	UI Renderer Component
	Dynamically loads and renders function UI components
-->
<script>
import { onMount } from 'svelte'

const { functionId, resultData, onClose } = $props()

let _Component = $state(null)
let _loading = $state(true)
let _error = $state(null)

onMount(async () => {
	try {
		// Use function loader to get the UI component loader
		const { loadFunction } = await import('./function-loader.js')
		const functionImpl = await loadFunction(functionId)

		if (!functionImpl.uiComponent) {
			throw new Error(`Function ${functionId} does not export uiComponent`)
		}

		// Load the actual Svelte component
		const componentModule = await functionImpl.uiComponent()
		_Component = componentModule.default
		_loading = false
	} catch (err) {
		_error = err.message || 'Failed to load UI component'
		_loading = false
	}
})
</script>

{#if loading}
	<div class="flex justify-center items-center p-8">
		<div class="text-sm text-slate-500">Loading...</div>
	</div>
{:else if error}
	<div class="p-6">
		<div class="text-sm text-red-600">Error: {error}</div>
	</div>
{:else if Component}
	<Component data={resultData} onClose={onClose} />
{/if}

