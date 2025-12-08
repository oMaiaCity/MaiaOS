<script lang="ts">
  import Vibe from "$lib/compositor/Vibe.svelte";
  import { todoVibeConfig } from "$lib/compositor/todo-config";
  import { browser } from "$app/environment";
</script>

{#if browser}
  <Vibe config={todoVibeConfig} />
{:else}
  <div class="min-h-screen bg-gray-100 pt-20 px-4 flex items-center justify-center">
    <div class="text-slate-600">Loading...</div>
  </div>
{/if}
