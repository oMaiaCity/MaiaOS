<script lang="ts">
  import ActorList from './ActorList.svelte';
  import ViewSelector from './ViewSelector.svelte';
  import JSONView from './views/JSONView.svelte';
  import InboxView from './views/InboxView.svelte';
  import ViewJSONView from './views/ViewJSONView.svelte';
  import ViewRenderedView from './views/ViewRenderedView.svelte';

  interface Props {
    accountCoState: any; // Jazz account CoState
  }

  const { accountCoState }: Props = $props();

  // State
  let selectedActorId = $state<string | null>(null);
  let selectedActor = $state<any>(null);
  let activeView = $state<'view-rendered' | 'json' | 'inbox' | 'view-json'>('view-rendered');

  // Handle actor selection
  function handleSelectActor(actorId: string, actor: any) {
    selectedActorId = actorId;
    selectedActor = actor;
  }

  // Handle view selection
  function handleSelectView(view: 'view-rendered' | 'json' | 'inbox' | 'view-json') {
    activeView = view;
  }
</script>

<div class="flex h-full w-full">
  <!-- Left Sidebar - Actor List -->
  <aside class="w-64 flex-shrink-0">
    <ActorList
      {accountCoState}
      {selectedActorId}
      onSelectActor={handleSelectActor}
    />
  </aside>

  <!-- Main View - Dynamic Content -->
  <main class="flex-1 min-w-0">
    {#if activeView === 'view-rendered'}
      <ViewRenderedView actor={selectedActor} {accountCoState} />
    {:else if activeView === 'json'}
      <JSONView actor={selectedActor} />
    {:else if activeView === 'inbox'}
      <InboxView actor={selectedActor} />
    {:else if activeView === 'view-json'}
      <ViewJSONView actor={selectedActor} />
    {/if}
  </main>

  <!-- Right Sidebar - View Selector -->
  <aside class="w-64 flex-shrink-0">
    <ViewSelector {activeView} onSelectView={handleSelectView} />
  </aside>
</div>
