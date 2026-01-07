<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { untrack } from "svelte";
  import { getJazzAccountContext } from "$lib/contexts/jazz-account-context";
  import ActorRenderer from "$lib/compositor/actors/ActorRenderer.svelte";
  import { createHumansActors } from "$lib/vibes/humans/config";
  import { createVibesActors } from "$lib/vibes/vibes/config";
  import { createDesignTemplatesActors } from "$lib/vibes/design-templates/config";
  import { CoState } from "jazz-tools/svelte";
  import { Actor } from "@hominio/db";

  // Get global Jazz account from context (AccountCoState instance)
  const accountCoState = getJazzAccountContext();

  // Get vibe ID from route params (reactive)
  const vibeId = $derived($page.url.searchParams.get("vibe"));

  // TRACKING STATE (Internal to this page)
  let rootActorId = $state<string | null>(null);
  let lastProcessedVibe = $state<string | null>(null);
  let isInitializing = false; // Module-level lock for async creation
  let lastProcessedMessageId = $state<string | null>(null);
  let pageLoadTime = $state<number | null>(null);
  
  // Track page load time to ignore stale messages
  $effect(() => {
    if (browser && pageLoadTime === null) {
      pageLoadTime = Date.now();
    }
  });

  // 1. LAZY LOADING - Ensure collections are loading
  $effect(() => {
    const account = accountCoState?.current;
    if (!account?.$isLoaded) return;
    
    untrack(async () => {
      try {
        // Load essential collections via account.ensureLoaded
        // This is the SINGLE reliable way to ensure nested data is available
        await account.$jazz.ensureLoaded({ 
          resolve: { 
            root: {
              actors: true,
              vibes: true,
              entities: true
            } 
          } 
        });
        console.log('[+page.svelte] Collections loaded successfully');
      } catch (err) {
        console.error('[+page.svelte] Lazy loading error:', err);
      }
    });
  });

  // 2. ROOT ACTOR LOADING - Pure reactive CoState
  const rootActorCoState = $derived.by(() => {
    if (!rootActorId || !browser) return null;
    return new CoState(Actor, rootActorId);
  });
  const rootActor = $derived(rootActorCoState?.current);

  // 3. INITIALIZATION LOOP - Spawns actors if not in registry
  $effect(() => {
    const currentVibe = vibeId ?? 'vibes';
    const account = accountCoState?.current;
    
    // REACTIVE DEPENDENCIES (outside untrack)
    // We want this effect to rerun when the account, root, or registry loading state changes
    if (!browser || !account?.$isLoaded) return;
    
    const root = account.root;
    if (!root?.$isLoaded) return;

    const registry = root.vibes;
    
    // Wait for migration to create the registry
    if (!registry) {
      console.log('[+page.svelte] Waiting for migration to create root.vibes...');
      return;
    }
    
    // Wait for registry to be fully loaded
    if (!registry.$isLoaded) {
      console.log('[+page.svelte] Waiting for root.vibes to load...');
      return;
    }

    // REACTIVE ACCESS to registry content
    // VibesRegistry is a co.map({vibes, humans, designTemplates}) with schema properties, not a passthrough map
    // So we access the properties directly instead of using $jazz.get()
    const registeredId = (
      currentVibe === 'vibes' ? registry.vibes :
      currentVibe === 'humans' ? registry.humans :
      currentVibe === 'designTemplates' ? registry.designTemplates :
      undefined
    ) as string | undefined;
    
    console.log(`[+page.svelte] ✓ Registry ready for ${currentVibe}. registeredId: ${registeredId}, rootActorId: ${rootActorId}, isInitializing: ${isInitializing}`);

    // If we have a rootActorId but it doesn't match the registry (and we aren't currently creating one)
    // it means the registry was cleared or updated externally - we need to reset our local state.
    if (rootActorId && rootActorId !== registeredId && !isInitializing) {
      console.log(`[+page.svelte] ⚠️ Registry ID mismatch for ${currentVibe} (registry: ${registeredId}, local: ${rootActorId}). Resetting local state...`);
      untrack(() => {
        rootActorId = null;
        lastProcessedVibe = null;
      });
      return;
    }

    // Only proceed if vibeId changed OR if we don't have a rootActorId yet
    if (lastProcessedVibe === currentVibe && rootActorId) return;

    untrack(async () => {
      if (isInitializing) {
        console.log('[+page.svelte] Already initializing, skipping...');
        return;
      }
      
      console.log('[+page.svelte] Checking registry for', currentVibe);

      // Handle missing registry (wait for migration)
      if (!registry) {
        console.log('[+page.svelte] Registry missing (root.vibes), waiting for migration...');
        // Try to trigger loading again if it's missing but should be there
        account.$jazz.ensureLoaded({ resolve: { root: { vibes: true } } }).catch(() => {});
        return;
      }

      // Check if this vibe is already registered
      if (registeredId && typeof registeredId === 'string' && registeredId.startsWith('co_')) {
        console.log('[+page.svelte] ✅ Found registered root for', currentVibe, ':', registeredId);
        rootActorId = registeredId;
        lastProcessedVibe = currentVibe;
        return;
      }

      // Not in registry, start initialization
      console.log('[+page.svelte] 🚀 Initializing new actors for', currentVibe);
      isInitializing = true;
      rootActorId = null; // Show loading state

      try {
        let newRootId: string | undefined;
        if (currentVibe === 'humans') {
          console.log('[+page.svelte] Calling createHumansActors...');
          newRootId = await createHumansActors(account);
        } else if (currentVibe === 'designTemplates') {
          console.log('[+page.svelte] Calling createDesignTemplatesActors...');
          newRootId = await createDesignTemplatesActors(account);
        } else {
          console.log('[+page.svelte] Calling createVibesActors...');
          newRootId = await createVibesActors(account);
        }

        if (newRootId) {
          console.log('[+page.svelte] ✅ Created root for', currentVibe, ':', newRootId);
          rootActorId = newRootId;
          lastProcessedVibe = currentVibe;
        } else {
          console.warn('[+page.svelte] Actor creation returned no ID for', currentVibe);
        }
      } catch (error: any) {
        if (!error?.message?.includes('Already creating')) {
          console.error('[+page.svelte] ❌ Initialization failed for', currentVibe, ':', error);
          lastProcessedVibe = null; // Allow retry
        } else {
          console.log('[+page.svelte] Concurrency: Already creating', currentVibe);
        }
      } finally {
        isInitializing = false;
      }
    });
  });

  // 4. NAVIGATION HANDLER - Watch inbox for SELECT_VIBE
  const latestRootMessage = $derived.by(() => {
    if (!rootActor?.$isLoaded) return null;
    const inbox = rootActor.inbox;
    if (!inbox?.$isLoaded) return null;
    return inbox.byMe?.value;
  });

  $effect(() => {
    if (!latestRootMessage?.$isLoaded || !browser || !pageLoadTime) return;

    if (latestRootMessage.type === 'SELECT_VIBE') {
      const messageId = latestRootMessage.$jazz?.id;
      if (messageId === lastProcessedMessageId) return;
      
      const payload = latestRootMessage.payload as any;
      const messageVibeId = payload?.vibeId;
      const messageTimestamp = latestRootMessage.timestamp || 0;
      
      if (messageVibeId && messageTimestamp > pageLoadTime) {
        lastProcessedMessageId = messageId;
        console.log('[+page.svelte] Navigation requested to:', messageVibeId);
        goto(`/vibes?vibe=${messageVibeId}`, { noScroll: true });
      }
    }
  });
</script>

{#if browser}
  {#if rootActorId}
    <div class="h-full w-full">
      <ActorRenderer actorId={rootActorId} {accountCoState} />
    </div>
  {:else}
    <div class="h-full bg-gray-100 pt-20 px-4 flex items-center justify-center">
      <div class="text-slate-600">Loading actors...</div>
    </div>
  {/if}
{:else}
  <div class="h-full bg-gray-100 pt-20 px-4 flex items-center justify-center">
    <div class="text-slate-600">Loading...</div>
  </div>
{/if}
