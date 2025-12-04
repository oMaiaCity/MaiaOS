<script lang="ts">
  import CoListGridCard from "./CoListGridCard.svelte";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rootData: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rootCoValue?: any; // The actual root CoValue to access CoLists directly
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

  // Handle grid card click - navigate to CoList
  function handleGridCardClick(key: string, value: any) {
    if (onCoListClick) {
      // Get the actual CoList from rootCoValue
      if (rootCoValue && rootCoValue.$isLoaded && rootCoValue[key]) {
        const coList = rootCoValue[key];
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        onCoListClick(coList, label, key);
      } else if (value.coValue) {
        // Fallback to stored reference
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        onCoListClick(value.coValue, label, key);
      }
    }
  }
</script>

{#if Object.keys(rootData.properties).length > 0}
  <!-- Grid View: Show preview cards for CoLists -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {#each Object.entries(rootData.properties) as [key, value]}
      {#if typeof value === "object" && value !== null && "type" in value && value.type === "CoList"}
        <CoListGridCard
          {value}
          {key}
          isSelected={false}
          onClick={() => handleGridCardClick(key, value)}
        />
      {/if}
    {/each}
  </div>
{:else}
  <p class="text-sm text-slate-500 italic">No CoValues found</p>
{/if}

