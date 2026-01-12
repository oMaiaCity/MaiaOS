<script lang="ts">
  import { CoState } from 'jazz-tools/svelte';
  import { Actor } from '@maia/db';

  interface Props {
    accountCoState: any;
    selectedActorId: string | null;
    onSelectActor: (actorId: string, actor: any) => void;
  }

  const { accountCoState, selectedActorId, onSelectActor }: Props = $props();

  // State for actor CoStates (with schema wrapper for proper nested loading)
  let actorCoStates = $state<Array<CoState<typeof Actor>>>([]);
  
  // Query actor IDs and create CoState instances with Actor schema
  $effect(() => {
    const account = accountCoState.current;
    if (!account?.$isLoaded) {
      actorCoStates = [];
      return;
    }
    
    const entities = account.root?.entities;
    if (!entities?.$isLoaded) {
      actorCoStates = [];
      return;
    }
    
    // Get actor IDs from entities (filter for actors with role/view properties)
    const actorIds: string[] = [];
    for (const entity of Array.from(entities) as any[]) {
      if (!entity?.$isLoaded) continue;
      const snapshot = entity.$jazz?.raw?.toJSON();
      // Check if entity has actor properties
      if (snapshot && ('role' in snapshot || 'view' in snapshot)) {
        const id = entity.$jazz?.id;
        if (id) actorIds.push(id);
      }
    }
    
    // Create CoState instances with Actor schema - this enables proper nested loading
    actorCoStates = actorIds.map(id => new CoState(Actor, id));
  });
  
  // Derive loaded actors from CoStates (Jazz handles nested loading automatically)
  const actors = $derived.by(() => {
    return actorCoStates
      .map(cs => cs.current)
      .filter(actor => actor?.$isLoaded);
  });
  
  // Trigger lazy loading of inbox for each actor by accessing it
  $effect(() => {
    actors.forEach((actor: any) => {
      if (actor?.$isLoaded) {
        // Access inbox to trigger Jazz lazy loading (creates reactive subscription)
        const _ = actor.inbox;
      }
    });
  });

  // Get actor display info (role or ID snippet)
  function getActorDisplay(actor: any): { label: string; id: string } {
    const snapshot = actor.$jazz?.raw?.toJSON();
    const id = actor.$jazz?.id || 'unknown';
    const role = snapshot?.role;
    
    return {
      label: role || id.slice(3, 13),
      id: id
    };
  }
</script>

<div class="flex flex-col h-full bg-slate-50 border-r border-slate-200">
  <div class="p-4 border-b border-slate-200">
    <h2 class="text-lg font-semibold text-slate-900">Actors</h2>
    <p class="text-sm text-slate-500 mt-1">
      {actors.length} actor{actors.length !== 1 ? 's' : ''} found
    </p>
  </div>
  
  <div class="flex-1 overflow-y-auto">
    {#if actors.length === 0}
      <div class="p-4 text-center text-slate-500">
        <p>No actors found</p>
      </div>
    {:else}
      <ul class="divide-y divide-slate-200">
        {#each actors as actor}
          {@const display = getActorDisplay(actor)}
          {@const isSelected = selectedActorId === display.id}
          <li>
            <button
              class="w-full text-left px-4 py-3 hover:bg-slate-100 transition-colors {isSelected ? 'bg-blue-100 border-l-4 border-blue-500' : ''}"
              onclick={() => onSelectActor(display.id, actor)}
            >
              <div class="font-medium text-slate-900 truncate">
                {display.label}
              </div>
              <div class="text-xs text-slate-500 font-mono truncate mt-1">
                {display.id}
              </div>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
