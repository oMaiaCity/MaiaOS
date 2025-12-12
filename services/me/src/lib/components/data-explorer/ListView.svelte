<script lang="ts">
  import type { LocalNode } from "cojson";
  import type { CoValueContext } from "@hominio/data";
  import ListItem from "./ListItem.svelte";

  interface Props {
    properties: Record<string, any>;
    node?: LocalNode;
    directChildren?: CoValueContext["directChildren"]; // Optional direct children for type resolution
    onNavigate?: (coValueId: string, label?: string) => void;
  }

  let { properties, node, directChildren, onNavigate }: Props = $props();

  const entries = $derived(Object.entries(properties));
</script>

<div class="space-y-3">
  {#each entries as [key, value]}
    {@const child = directChildren?.find((c) => c.key === key)}
    <ListItem propKey={key} propValue={value} {node} resolvedType={child?.resolved} {onNavigate} />
  {/each}
</div>





