<script lang="ts">
  interface Props {
    padding?: "p-4" | "p-5" | "p-6";
    showGlossy?: boolean;
    hoverable?: boolean;
    selected?: boolean;
    class?: string;
    children: any;
  }

  let {
    padding = "p-6",
    showGlossy = true,
    hoverable = false,
    selected = false,
    class: className = "",
    children,
  }: Props = $props();

  const cardClasses = $derived(() => {
    let classes = "card";
    if (hoverable) classes += " card-hoverable";
    if (selected) classes += " card-selected";
    return `${classes} ${padding} ${className}`.trim();
  });
</script>

<div class={cardClasses()}>
  {#if showGlossy}
    <!-- Glossy gradient overlay -->
    <div class="absolute inset-0 pointer-events-none"></div>
  {/if}
  <div class="relative">
    {@render children()}
  </div>
</div>

