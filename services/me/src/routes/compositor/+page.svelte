<script lang="ts">
  import Compositor from "$lib/compositor/Compositor.svelte";
  import { todoCompositorConfig } from "$lib/compositor/todo-config";
  import { browser } from "$app/environment";
</script>

{#if browser}
  <Compositor config={todoCompositorConfig} />
{:else}
  <div class="min-h-screen bg-gray-100 pt-20 px-4 flex items-center justify-center">
    <div class="text-slate-600">Loading...</div>
  </div>
{/if}
