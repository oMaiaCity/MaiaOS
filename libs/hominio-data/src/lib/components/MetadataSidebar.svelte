<script lang="ts">
  import JazzMetadata from "./JazzMetadata.svelte";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedCoValue?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentAccount?: any; // Current Jazz account for profile resolution
  }

  let { selectedCoValue, currentAccount }: Props = $props();
</script>

{#if selectedCoValue && selectedCoValue.$isLoaded}
  <!-- Metadata content (Card wrapper handled by DataLayout) -->
  <JazzMetadata coValue={selectedCoValue} showKeys={true} {currentAccount} />
{:else}
  <!-- Empty state (Card wrapper handled by DataLayout) -->
  <div class="text-center py-8">
    <svg
      class="w-12 h-12 text-slate-300 mx-auto mb-3"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
    <p class="text-sm text-slate-400">Select a CoValue to view metadata</p>
  </div>
{/if}
