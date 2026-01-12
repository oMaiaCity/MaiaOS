<script lang="ts">
  interface Props {
    actor: any; // Jazz Actor CoValue
  }

  const { actor }: Props = $props();

  // Extract all inbox messages (multi-account view via perAccount)
  const inboxMessages = $derived.by(() => {
    if (!actor?.$isLoaded || !actor.inbox?.$isLoaded) return [];
    
    const messages: any[] = [];
    const inbox = actor.inbox;
    
    // Use perAccount to show messages from ALL accounts (including yours)
    // This avoids duplicates while showing multi-account collaboration
    // perAccount[accountId] contains messages indexed by sender's account
    if (inbox.perAccount) {
      for (const accountId in inbox.perAccount) {
        const accountFeed = inbox.perAccount[accountId];
        
        if (accountFeed?.all) {
          for (const entry of accountFeed.all) {
            if (entry.value?.$isLoaded) {
              const message = entry.value;
              messages.push({
                id: message.$jazz?.id,
                type: message.type,
                payload: message.payload,
                from: message.from,
                timestamp: message.timestamp,
                madeAt: entry.madeAt,
                source: `perAccount[${accountId.slice(3, 10)}]`
              });
            }
          }
        } else if (accountFeed?.value?.$isLoaded) {
          const message = accountFeed.value;
          messages.push({
            id: message.$jazz?.id,
            type: message.type,
            payload: message.payload,
            from: message.from,
            timestamp: message.timestamp,
            source: `perAccount[${accountId.slice(3, 10)}]`
          });
        }
      }
    }
    
    // Fallback: If perAccount is empty, try byMe (single account scenario)
    if (messages.length === 0 && inbox.byMe?.all) {
      for (const entry of inbox.byMe.all) {
        if (entry.value?.$isLoaded) {
          const message = entry.value;
          messages.push({
            id: message.$jazz?.id,
            type: message.type,
            payload: message.payload,
            from: message.from,
            timestamp: message.timestamp,
            madeAt: entry.madeAt,
            source: 'byMe'
          });
        }
      }
    } else if (messages.length === 0 && inbox.byMe?.value?.$isLoaded) {
      const message = inbox.byMe.value;
      messages.push({
        id: message.$jazz?.id,
        type: message.type,
        payload: message.payload,
        from: message.from,
        timestamp: message.timestamp,
        source: 'byMe'
      });
    }
    
    // Sort by timestamp
    return messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  });

  const watermark = $derived(actor?.inboxWatermark);
</script>

<div class="flex flex-col h-full bg-white border-l border-slate-200">
  <!-- Header -->
  <div class="p-4 border-b border-slate-200">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-slate-900">Inbox Messages</h2>
      <span class="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded font-mono">
        {inboxMessages.length} message{inboxMessages.length !== 1 ? 's' : ''}
      </span>
    </div>
    
    {#if watermark}
      <div class="mt-2 text-xs text-slate-500">
        <span class="font-semibold">Watermark:</span>
        <span class="ml-1 font-mono">{watermark}</span>
      </div>
    {/if}
  </div>
  
  <!-- Messages List -->
  <div class="flex-1 overflow-y-auto p-4">
    {#if !actor?.$isLoaded}
      <p class="text-sm text-slate-500 italic">No actor selected</p>
    {:else if !actor.inbox?.$isLoaded}
      <p class="text-sm text-slate-500 italic">Loading inbox...</p>
    {:else if inboxMessages.length === 0}
      <p class="text-sm text-slate-500 italic">No messages in inbox</p>
    {:else}
      <div class="space-y-2">
        {#each inboxMessages as message, i}
          {@const isProcessed = message.timestamp <= (watermark || 0)}
          <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 {isProcessed ? 'opacity-60' : ''}">
            <!-- Message Header -->
            <div class="flex items-start justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-slate-700">#{i + 1}</span>
                <span class="text-xs px-2 py-0.5 rounded font-mono {isProcessed ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}">
                  {isProcessed ? 'PROCESSED' : 'NEW'}
                </span>
              </div>
              <span class="text-xs text-slate-500">
                {new Date(message.timestamp || 0).toLocaleString()}
              </span>
            </div>
            
            <!-- Message Type -->
            <div class="mb-2">
              <span class="text-xs text-slate-500">Type:</span>
              <span class="ml-1 text-sm font-mono text-slate-900">{message.type}</span>
            </div>
            
            <!-- Message Payload -->
            <div class="mb-2">
              <span class="text-xs text-slate-500">Payload:</span>
              <pre class="mt-1 text-xs font-mono text-slate-700 bg-white border border-slate-200 rounded p-2 overflow-x-auto">{JSON.stringify(message.payload, null, 2)}</pre>
            </div>
            
            <!-- Message Metadata -->
            <div class="flex items-center gap-4 text-xs text-slate-500">
              <div>
                <span>From:</span>
                <span class="ml-1 font-mono">{message.from?.slice(3, 13)}...</span>
              </div>
              <div>
                <span>Source:</span>
                <span class="ml-1 font-mono">{message.source}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
