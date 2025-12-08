<!--
  View Renderer Component
  Entry point for rendering view nodes
  Determines if node is composite or leaf and delegates accordingly
-->
<script lang="ts">
  import type { ViewNode } from "./types";
  import type { Data } from "../dataStore";
  import Composite from "./Composite.svelte";
  import Leaf from "./Leaf.svelte";

  interface Props {
    node: ViewNode;
    data: Data;
    onEvent?: (event: string, payload?: unknown) => void;
  }

  let { node, data, onEvent }: Props = $props();
</script>

{#if node.composite}
  <!-- Composite node - render as layout container -->
  <Composite {node} {data} {onEvent} />
{:else if node.dataPath}
  <!-- Leaf node - render as content -->
  <Leaf {node} {data} {onEvent} />
{:else}
  <!-- Invalid node - neither composite nor leaf -->
  <div class="text-red-500 text-sm">Invalid view node: must have either composite or dataPath</div>
{/if}

