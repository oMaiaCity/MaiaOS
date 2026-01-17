<script lang="ts">
  import { browser } from '$app/environment';

  interface Props {
    actor: any; // Jazz Actor CoValue
  }

  const { actor }: Props = $props();

  // Extract all inbox messages (multi-account view via perAccount)
  const inboxMessages = $derived.by(() => {
    if (!actor?.$isLoaded || !actor.inbox?.$isLoaded) return [];
    
    const messages: any[] = [];
    const inbox = actor.inbox;
    
    // Use perAccount to show messages from ALL accounts (avoids duplicates)
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
    
    // Fallback: If perAccount is empty, try byMe
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
    
    // Sort by timestamp (oldest first)
    return messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  });

  // Serialize actor to JSON
  const actorJSON = $derived.by(() => {
    if (!actor?.$isLoaded) return null;
    
    const snapshot = actor.$jazz?.raw?.toJSON();
    const watermark = actor.inboxWatermark;
    
    // Resolve view CoValue - extract text content if it's a co.plainText()
    let resolvedView = snapshot?.view;
    if (resolvedView && typeof resolvedView === 'string' && resolvedView.startsWith('co_')) {
      // View is a CoValue ID - try to resolve it
      const viewCoValue = actor.view;
      if (viewCoValue && typeof viewCoValue === 'object' && viewCoValue.toString) {
        // Get the text content from co.plainText()
        resolvedView = viewCoValue.toString();
        try {
          // Try to parse as JSON for pretty display
          resolvedView = JSON.parse(resolvedView);
        } catch {
          // Not JSON, keep as string
        }
      }
    }
    
    return {
      id: actor.$jazz?.id,
      role: snapshot?.role,
      inboxWatermark: watermark || null, // Keep in JSON as-is
      context: snapshot?.context,
      view: resolvedView, // Resolved view content instead of CoValue ID
      dependencies: snapshot?.dependencies,
      subscriptions: Array.from(actor.subscriptions || []),
      children: Array.from(actor.children || []),
      inbox: {
        isLoaded: actor.inbox?.$isLoaded || false,
        messageCount: inboxMessages.length,
        watermark: watermark || null, // Explicitly show null if no watermark
        messages: inboxMessages
      }
    };
  });

  // Format JSON with syntax highlighting
  const formattedJSON = $derived(
    actorJSON ? JSON.stringify(actorJSON, null, 2) : null
  );

  // Copy to clipboard
  function copyToClipboard() {
    if (!browser || !formattedJSON) return;
    
    navigator.clipboard.writeText(formattedJSON).then(() => {
      // Show temporary success feedback
      const btn = document.getElementById('copy-btn');
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      }
    });
  }

  // Get actor role for header
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
  {:else if !actor.$isLoaded}
    <div class="flex items-center justify-center h-full text-slate-500">
      <p>Loading actor...</p>
    </div>
  {:else}
    <!-- Header -->
    <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
      <div class="flex-1 min-w-0">
        <h2 class="text-xl font-semibold text-slate-900 truncate">
          {actorRole}
        </h2>
        <div class="flex items-center gap-3 mt-1">
          <p class="text-sm text-slate-500 font-mono truncate">
            {actor.$jazz?.id}
          </p>
        </div>
      </div>
      <button
        id="copy-btn"
        class="ml-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
        onclick={copyToClipboard}
      >
        Copy JSON
      </button>
    </div>

    <!-- Content: Actor JSON -->
    <div class="flex-1 overflow-y-auto p-6 space-y-6">
      <!-- Actor JSON Display -->
      <div class="space-y-3">
        <h3 class="text-lg font-semibold text-slate-900">Actor Properties</h3>
        {#if formattedJSON}
          <pre class="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto"><code class="font-mono text-sm">{formattedJSON}</code></pre>
        {:else}
          <div class="text-center text-slate-500 py-8">
            <p>Unable to load actor data</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
