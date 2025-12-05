<script lang="ts">
  interface Props {
    padding?: "p-4" | "p-5" | "p-6";
    showGlossy?: boolean;
    class?: string;
    children: any;
  }

  let { padding = "p-6", showGlossy = true, class: className = "", children }: Props = $props();
</script>

<div
  class="relative overflow-hidden rounded-3xl bg-slate-50 border border-white shadow-[0_0_8px_rgba(0,0,0,0.03)] {padding} {className}"
>
  {#if showGlossy}
    <!-- Glossy gradient overlay -->
    <div class="absolute inset-0 pointer-events-none"></div>
  {/if}
  <div class="relative">
    {@render children()}
  </div>
</div>
