<script lang="ts">
  import { browser } from '$app/environment';

  interface Props {
    actor: any; // Jazz Actor CoValue
  }

  const { actor }: Props = $props();

  // Serialize actor to JSON (extracted from ActorDetail)
  const actorJSON = $derived.by(() => {
    if (!actor?.$isLoaded) return null;
    
    const snapshot = actor.$jazz?.raw?.toJSON();
    const watermark = actor.inboxWatermark;
    
    // Resolve view CoValue - extract text content if it's a co.plainText()
    let resolvedView = snapshot?.view;
    if (resolvedView && typeof resolvedView === 'string' && resolvedView.startsWith('co_')) {
      const viewCoValue = actor.view;
      if (viewCoValue && typeof viewCoValue === 'object' && viewCoValue.toString) {
        resolvedView = viewCoValue.toString();
        try {
          resolvedView = JSON.parse(resolvedView);
        } catch {
          // Not JSON, keep as string
        }
      }
    }
    
    // Count inbox messages
    let messageCount = 0;
    if (actor.inbox?.$isLoaded) {
      const inbox = actor.inbox;
      if (inbox.perAccount) {
        for (const accountId in inbox.perAccount) {
          const accountFeed = inbox.perAccount[accountId];
          if (accountFeed?.all) {
            messageCount += Array.from(accountFeed.all).length;
          }
        }
      }
    }
    
    return {
      id: actor.$jazz?.id,
      role: snapshot?.role,
      inboxWatermark: watermark || null,
      context: snapshot?.context,
      view: resolvedView,
      dependencies: snapshot?.dependencies,
      subscriptions: Array.from(actor.subscriptions || []),
      children: Array.from(actor.children || []),
      inbox: {
        isLoaded: actor.inbox?.$isLoaded || false,
        messageCount,
        watermark: watermark || null,
      }
    };
  });

  const formattedJSON = $derived(
    actorJSON ? JSON.stringify(actorJSON, null, 2) : null
  );

  function copyToClipboard() {
    if (!browser || !formattedJSON) return;
    
    navigator.clipboard.writeText(formattedJSON).then(() => {
      const btn = document.getElementById('copy-json-btn');
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      }
    });
  }

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
        id="copy-json-btn"
        class="ml-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
        onclick={copyToClipboard}
      >
        Copy JSON
      </button>
    </div>

    <!-- Content: Actor JSON -->
    <div class="flex-1 overflow-y-auto p-6 space-y-6">
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
