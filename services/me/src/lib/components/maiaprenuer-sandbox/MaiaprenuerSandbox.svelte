<script lang="ts">
  import ActorList from './ActorList.svelte';
  import ActorDetail from './ActorDetail.svelte';
  import InboxMessages from './InboxMessages.svelte';

  interface Props {
    accountCoState: any; // Jazz account CoState
  }

  const { accountCoState }: Props = $props();

  // State
  let selectedActorId = $state<string | null>(null);
  let selectedActor = $state<any>(null);

  // Handle actor selection - Actors loaded via CoState with schema
  function handleSelectActor(actorId: string, actor: any) {
    selectedActorId = actorId;
    selectedActor = actor;
    
    const snapshot = actor?.$jazz?.raw?.toJSON();
    const inbox = actor?.inbox;
    
    console.log('[MaiapreneurSandbox] Actor selected:', {
      actorId,
      hasInbox: !!inbox,
      inboxLoaded: inbox?.$isLoaded,
      inboxType: inbox ? typeof inbox : 'undefined',
      inboxId: typeof inbox === 'object' ? inbox?.$jazz?.id : inbox,
      snapshotInbox: snapshot?.inbox,
      actorKeys: Object.keys(actor || {}),
      fullSnapshot: snapshot
    });
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

  <!-- Main View - Actor Detail (JSON) -->
  <main class="flex-1 min-w-0">
    <ActorDetail actor={selectedActor} />
  </main>

  <!-- Right Sidebar - Inbox Messages -->
  <aside class="w-96 flex-shrink-0">
    <InboxMessages actor={selectedActor} />
  </aside>
</div>
