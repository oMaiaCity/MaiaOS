<script lang="ts">
  import { getBadgeColors, getBadgeVariantClasses } from '../../utilities/badgeUtilities.js';

  interface Props {
    type?: string; // Type name (e.g., "string", "CoList", "Image") - will auto-map to color
    variant?: "default" | "compact" | "role"; // Badge style variant
    class?: string; // Additional classes
    children: import("svelte").Snippet; // Badge content (usually the type name)
  }

  let { type, variant = "default", class: className = "", children }: Props = $props();

  const badgeType = $derived(type || "");
  const colors = $derived(getBadgeColors(badgeType));
  const variantClasses = $derived(getBadgeVariantClasses(variant));
</script>

<span class="{variantClasses} {colors.bg} {className}">
  {@render children()}
</span>

