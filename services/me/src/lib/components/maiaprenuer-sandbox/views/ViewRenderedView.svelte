<script lang="ts">
  import ActorEngine from '$lib/compositor/engines/ActorEngine.svelte';

  interface Props {
    actor: any; // Jazz Actor CoValue
    accountCoState: any; // Jazz account CoState for context
  }

  const { actor, accountCoState }: Props = $props();

  // Get actor ID for ActorEngine
  const actorId = $derived(actor?.$jazz?.id);

  const actorRole = $derived.by(() => {
    if (!actor?.$isLoaded) return 'Loading...';
    const snapshot = actor.$jazz?.raw?.toJSON();
    return snapshot?.role || 'Unknown Actor';
  });
</script>

<div class="flex flex-col h-full bg-white">
  {#if !actor}
    <div class="flex items-center justify-center h-full text-slate-500">
      <p>Select an actor to view details</p>
    </div>
  {:else if !actor.$isLoaded || !actorId}
    <div class="flex items-center justify-center h-full text-slate-500">
      <p>Loading actor...</p>
    </div>
  {:else}
    <!-- Header -->
    <div class="px-6 py-4 border-b border-slate-200">
      <h2 class="text-xl font-semibold text-slate-900 truncate">
        View Rendered
      </h2>
      <div class="flex items-center gap-3 mt-1">
        <p class="text-sm text-slate-500 truncate">
          {actorRole}
        </p>
      </div>
    </div>

    <!-- Content: Rendered View using ActorEngine -->
    <div class="flex-1 overflow-y-auto p-6">
      <ActorEngine
        {actorId}
        {accountCoState}
      />
    </div>
  {/if}
</div>
