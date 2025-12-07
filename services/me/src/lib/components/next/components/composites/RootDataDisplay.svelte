<script lang="ts">
  import CoListGridCard from "./CoListGridCard.svelte";
  import CoMapGridCard from "./CoMapGridCard.svelte";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rootData: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rootCoValue?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractCoValueProperties: (coValue: any) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSelect: (coValue: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onCoListClick?: (coList: any, label: string, parentKey?: string) => void;
  }

  let {
    rootData,
    rootCoValue,
    extractCoValueProperties,
    onSelect,
    onCoListClick,
  }: Props = $props();

  function handleCoListClick(key: string, value: any) {
    if (onCoListClick) {
      if (rootCoValue && rootCoValue.$isLoaded && rootCoValue[key]) {
        const coList = rootCoValue[key];
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        onCoListClick(coList, label, key);
      } else if (value.coValue) {
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        onCoListClick(value.coValue, label, key);
      }
    }
  }

  function handleCoMapClick(key: string, value: any) {
    if (value.coValue && onSelect) {
      onSelect(value.coValue);
    }
  }
</script>

{#if Object.keys(rootData.properties).length > 0}
  {@const sortedEntries = Object.entries(rootData.properties).sort(([keyA, valueA], [keyB, valueB]) => {
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

