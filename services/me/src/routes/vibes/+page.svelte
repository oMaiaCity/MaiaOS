<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import Vibe from "$lib/compositor/Vibe.svelte";
  import { todoVibeConfig } from "$lib/vibes/todo/config";
  import { vibesVibeConfig } from "$lib/vibes/vibes/config";
  import { walletVibeConfig } from "$lib/vibes/wallet/config";

  // Get vibe ID from route params (reactive)
  const vibeId = $derived($page.url.searchParams.get("id"));

  // Available vibe configs
  const vibeConfigs: Record<string, typeof vibesVibeConfig> = {
    todo: todoVibeConfig,
    wallet: walletVibeConfig,
  };

  // Determine which config to use (reactive to route changes)
  const currentConfig = $derived(
    vibeId && vibeConfigs[vibeId] ? vibeConfigs[vibeId] : vibesVibeConfig,
  );

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
  <div class="h-screen w-screen">
    <Vibe config={currentConfig} onEvent={handleVibeEvent} />
  </div>
{:else}
  <div
    class="min-h-screen bg-gray-100 pt-20 px-4 flex items-center justify-center"
  >
    <div class="text-slate-600">Loading...</div>
  </div>
{/if}
