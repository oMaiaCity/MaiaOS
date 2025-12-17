<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { getJazzAccountContext } from "$lib/contexts/jazz-account-context";
  import Vibe from "$lib/compositor/view/Vibe.svelte";
  import { todoVibeConfig } from "$lib/vibes/todo/config";
  import { humansVibeConfig } from "$lib/vibes/humans/config";
  import { vibesVibeConfig } from "$lib/vibes/vibes/config";

  // Get global Jazz account from context (AccountCoState instance)
  const accountCoState = getJazzAccountContext();

  // Get vibe ID from route params (reactive)
  const vibeId = $derived($page.url.searchParams.get("id"));

  // Available vibe configs
  const vibeConfigs: Record<string, typeof vibesVibeConfig> = {
    todo: todoVibeConfig,
    humans: humansVibeConfig,
  };

  // Determine which config to use (reactive to route changes)
  const currentConfig = $derived(
    vibeId && vibeConfigs[vibeId] ? vibeConfigs[vibeId] : vibesVibeConfig,
  );

  // Lazy load entities and schemata when this route is accessed
  // This ensures data is available for useQuery hooks
  $effect(() => {
    if (!browser || !accountCoState) return;
    
    const account = accountCoState.current;
    if (!account?.$isLoaded) return;
    
    const root = account.root;
    if (!root?.$isLoaded) return;
    
    // Trigger lazy loading of entities and schemata by accessing them
    // CoState will automatically load them when accessed
    // We access them in an effect so they load when the route is visited
    if (root.entities && !root.entities.$isLoaded) {
      root.entities.$jazz.ensureLoaded().catch(() => {
        // Ignore errors - useQuery handles missing data gracefully
      });
    }
    
    if (root.schemata && !root.schemata.$isLoaded) {
      root.schemata.$jazz.ensureLoaded().catch(() => {
        // Ignore errors - useQuery handles missing data gracefully
      });
    }
  });

  // Handle SELECT_VIBE events for navigation via route params
  function handleVibeEvent(event: string, payload?: unknown) {
    if (event === "SELECT_VIBE" && payload) {
      const id = (payload as { id?: string })?.id;
      if (id) {
        goto(`/vibes?id=${id}`, { noScroll: true });
      }
    }
  }
</script>

{#if browser}
  <div class="h-full w-full">
    <Vibe config={currentConfig} onEvent={handleVibeEvent} accountCoState={accountCoState} />
  </div>
{:else}
  <div class="h-full bg-gray-100 pt-20 px-4 flex items-center justify-center">
    <div class="text-slate-600">Loading...</div>
  </div>
{/if}
