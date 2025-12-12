<script lang="ts">
  import type { CoValueContext } from "@hominio/data";
  import type { LocalNode } from "cojson";
  import ListItem from "./ListItem.svelte";

  interface Props {
    properties: Record<string, any>;
    node?: LocalNode;
    directChildren?: CoValueContext["directChildren"]; // Optional direct children for type resolution
    onNavigate?: (coValueId: string, label?: string) => void;
    onObjectNavigate?: (
      object: any,
      label: string,
      parentCoValue: any,
      parentKey: string,
    ) => void;
    parentCoValue?: any; // Parent CoValue/snapshot for object navigation
  }

  const {
    properties,
    node,
    directChildren,
    onNavigate,
    onObjectNavigate,
    parentCoValue,
  }: Props = $props();

  const entries = $derived(Object.entries(properties));
</script>

<div class="space-y-3">
  {#each entries as [key, value]}
    {@const child = directChildren?.find((c) => c.key === key)}
    <ListItem
      propKey={key}
      propValue={value}
      {node}
      resolvedType={child?.resolved}
      {onNavigate}
      {onObjectNavigate}
      {parentCoValue}
    />
  {/each}
</div>
