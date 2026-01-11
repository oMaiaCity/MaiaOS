<script lang="ts">
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { untrack } from "svelte";
  import { getJazzAccountContext } from "$lib/utils/jazz-account-context";
  import ActorEngine from "$lib/compositor/engines/ActorEngine.svelte";
  import { getOrCreateVibe, getVibeIfExists } from "$lib/compositor/engines/seedingEngine";
  import { CoState } from "jazz-tools/svelte";
  import { Actor } from "@maia/db";

  // Get global Jazz account from context (AccountCoState instance)
  const accountCoState = getJazzAccountContext();

  // Get actor ID from route params (reactive) - falls back to vibe name for backwards compat
  const actorIdParam = $derived($page.url.searchParams.get("id"));
  const vibeNameParam = $derived($page.url.searchParams.get("vibe")); // Legacy support

  // TRACKING STATE (Internal to this page)
  let rootActorId = $state<string | null>(null);
  let lastProcessedVibe = $state<string | null>(null);
  let isInitializing = false; // Module-level lock for async creation
    
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
    // Prefer actor ID param, fall back to vibe name param
    const currentActorId = actorIdParam;
    const currentVibeName = vibeNameParam ?? 'vibes';
    const account = accountCoState?.current;
    
    // REACTIVE DEPENDENCIES (outside untrack)
    // We want this effect to rerun when the account, root, or registry loading state changes
    if (!browser || !account?.$isLoaded) return;
    
    const root = account.root;
    if (!root?.$isLoaded) return;

    // If we have a direct actor ID from URL, use it directly
    if (currentActorId && currentActorId.startsWith('co_')) {
      console.log(`[+page.svelte] ✓ Using direct actor ID from URL: ${currentActorId}`);
      if (rootActorId !== currentActorId) {
        rootActorId = currentActorId;
        lastProcessedVibe = currentVibeName;
      }
      return;
    }

    // Only proceed if vibe name changed OR if we don't have a rootActorId yet
    if (lastProcessedVibe === currentVibeName && rootActorId) return;

    untrack(async () => {
      if (isInitializing) {
        console.log('[+page.svelte] Already initializing, skipping...');
        return;
      }
      
      console.log('[+page.svelte] Checking registry for', currentVibeName);

      // Check if this vibe already exists
      const existingRootId = await getVibeIfExists(account, currentVibeName);
      
      console.log(`[+page.svelte] ✓ Registry ready for ${currentVibeName}. existingRootId: ${existingRootId}, rootActorId: ${rootActorId}, isInitializing: ${isInitializing}`);

      if (existingRootId) {
        console.log('[+page.svelte] ✅ Found registered root for', currentVibeName, ':', existingRootId);
        rootActorId = existingRootId;
        lastProcessedVibe = currentVibeName;
        return;
      }

      // Not in registry, start initialization
      console.log('[+page.svelte] 🚀 Initializing new actors for', currentVibeName);
      isInitializing = true;
      rootActorId = null; // Show loading state

      try {
        // Use central seeding manager
        const newRootId = await getOrCreateVibe(account, currentVibeName);

        if (newRootId) {
          console.log('[+page.svelte] ✅ Created root for', currentVibeName, ':', newRootId);
          rootActorId = newRootId;
          lastProcessedVibe = currentVibeName;
        } else {
          console.warn('[+page.svelte] Actor creation returned no ID for', currentVibeName);
        }
      } catch (error: any) {
        if (!error?.message?.includes('Already creating')) {
          console.error('[+page.svelte] ❌ Initialization failed for', currentVibeName, ':', error);
          lastProcessedVibe = null; // Allow retry
        } else {
          console.log('[+page.svelte] Concurrency: Already creating', currentVibeName);
        }
      } finally {
        isInitializing = false;
    }
    });
  });

  // 4. NAVIGATION - Handled by @ui/navigate skill
  // Skills handle complete navigation flow (actor swap + URL update)
</script>

{#if browser}
  {#if rootActorId}
    <!-- All vibes use ActorEngine -->
    <div class="h-full w-full min-h-0 overflow-hidden">
      <ActorEngine actorId={rootActorId} {accountCoState} />
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
