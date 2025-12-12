<!--
  Leaf Component
  Validates and renders leaf nodes using LeafRenderer
  Uses JSON-driven leaf definitions
-->
<script lang="ts">
import type { Data } from '../dataStore'
import type { VibeConfig } from '../types'
import type { ViewNode } from './types'
import { browser } from '$app/environment'
import { validateLeaf } from './whitelist'
import LeafRenderer from './LeafRenderer.svelte'

interface Props {
	node: ViewNode
	data: Data
	config?: VibeConfig
	onEvent?: (event: string, payload?: unknown) => void
}

const { node, data, config, onEvent }: Props = $props()

// Validate leaf
const validation = $derived(
	node.leaf ? validateLeaf(node.leaf) : { valid: false, errors: ['No leaf definition'] },
)

$effect(() => {
	if (!validation.valid) {
	}
})
</script>

{#if !browser}
  <!-- SSR fallback -->
  <div class="text-slate-600">Loading...</div>
{:else if node.leaf && validation.valid}
  <LeafRenderer leaf={node.leaf} {data} {onEvent} />
    {:else}
  <div class="text-red-500 p-4 rounded bg-red-50">
    Invalid leaf configuration: {validation.errors?.join(", ")}
  </div>
{/if}
