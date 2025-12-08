<!--
  View Renderer Component
  Entry point for rendering view nodes
  Determines if node is composite or leaf and delegates accordingly
-->
<script lang="ts">
  import type { ViewNode } from "./types";
  import type { Data } from "../dataStore";
  import type { VibeConfig } from "../types";
  import Composite from "./Composite.svelte";
  import Leaf from "./Leaf.svelte";

  interface Props {
    node: ViewNode;
    data: Data;
    config?: VibeConfig;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  let { node, data, config, onEvent }: Props = $props();
</script>

{#if node.composite}
  <!-- Composite node - render as layout container -->
  <Composite {node} {data} {config} {onEvent} />
{:else if node.dataPath}
  <!-- Leaf node - render as content -->
  <Leaf {node} {data} {config} {onEvent} />
{:else}
  <!-- Invalid node - neither composite nor leaf -->
  <div class="text-red-500 text-sm">Invalid view node: must have either composite or dataPath</div>
{/if}

