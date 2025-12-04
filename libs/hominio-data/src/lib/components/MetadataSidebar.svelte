<script lang="ts">
  import JazzMetadata from "./JazzMetadata.svelte";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedCoValue?: any;
  }

  let { selectedCoValue }: Props = $props();
</script>

{#if selectedCoValue && selectedCoValue.$isLoaded}
  <aside class="w-80 shrink-0 sticky top-6">
    <div class="space-y-4">
      <h2 class="text-lg font-semibold text-slate-700 flex items-center gap-2 mb-4">
        <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Metadata
      </h2>
      <JazzMetadata coValue={selectedCoValue} showKeys={true} />
    </div>
  </aside>
{:else}
  <aside class="w-80 shrink-0 sticky top-6">
    <div
      class="rounded-3xl border border-dashed border-white bg-slate-50/40 backdrop-blur-sm shadow-[0_0_6px_rgba(0,0,0,0.03)] p-8 text-center"
    >
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
  </aside>
{/if}


