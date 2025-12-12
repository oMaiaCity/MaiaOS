<script lang="ts">
  import type { LocalNode } from "cojson";
  import type { CoValueContext } from "@hominio/data";
  import CoListGridCard from "../composites/CoListGridCard.svelte";
  import CoMapGridCard from "../composites/CoMapGridCard.svelte";

  interface Props {
    properties: Record<string, any>;
    node?: LocalNode;
    directChildren: CoValueContext["directChildren"];
    onNavigate?: (coValueId: string, label?: string) => void;
  }

  let { properties, node, directChildren, onNavigate }: Props = $props();

  // Convert properties to grid card format - use same logic as ListView (just different UI)
  // Use resolved types from directChildren (same as ListView)
  const gridData = $derived(() => {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      // Skip internal properties
      if (key.startsWith("$")) continue;

      // Find resolved child info (same as ListView)
      const child = directChildren.find((c) => c.key === key);
      const resolved = child?.resolved;

      if (typeof value === "string" && value.startsWith("co_")) {
        // It's a CoID - determine type from resolved info (same as ListView)
        const type = resolved?.extendedType || resolved?.type || "CoValue";
        const normalizedType = type.toLowerCase();

        if (normalizedType === "colist" || normalizedType === "list") {
          result[key] = {
            type: "CoList",
            id: value,
            coValueId: value,
            length: 0, // Grid cards show 0 until clicked (just UI cosmetics)
          };
        } else {
          // Default to CoMap for comap, CoMap, CoValue, or any other type
          result[key] = {
            type: "CoMap",
            id: value,
            coValueId: value,
            properties: {}, // Grid cards show 0 properties until clicked (just UI cosmetics)
          };
        }
      }
    }

    return result;
  });

  function handleCoListClick(key: string, value: any) {
    if (onNavigate && value.coValueId) {
      onNavigate(value.coValueId, key);
    }
  }

  function handleCoMapClick(key: string, value: any) {
    if (onNavigate && value.coValueId) {
      onNavigate(value.coValueId, key);
    }
  }
</script>

{#if Object.keys(gridData).length > 0}
  {@const sortedEntries = Object.entries(gridData).sort(([keyA, valueA], [keyB, valueB]) => {
    if (keyA === "profile") return -1;
    if (keyB === "profile") return 1;
    if (valueA?.type === "CoList" && valueB?.type === "CoMap") return -1;
    if (valueA?.type === "CoMap" && valueB?.type === "CoList") return 1;
    return 0;
  })}
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {#each sortedEntries as [key, value]}
      {#if typeof value === "object" && value !== null && "type" in value}
        {#if value.type === "CoList"}
          <CoListGridCard
            {value}
            {key}
            isSelected={false}
            onClick={() => handleCoListClick(key, value)}
          />
        {:else if value.type === "CoMap"}
          <CoMapGridCard
            {value}
            {key}
            isSelected={false}
            onClick={() => handleCoMapClick(key, value)}
          />
        {/if}
      {/if}
    {/each}
  </div>
{:else}
  <p class="text-sm text-slate-500 italic">No CoValues found</p>
{/if}
