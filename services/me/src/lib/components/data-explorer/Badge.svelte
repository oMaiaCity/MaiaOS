<script lang="ts">
  /**
   * Data Explorer Badge Component
   * Matches legacy badge styling: fully rounded with white border
   */
  import { getBadgeColors, getBadgeVariantClasses } from "../../utilities/badgeUtilities.js";

  interface Props {
    type?: string;
    variant?: "default" | "compact";
    class?: string;
    children: import("svelte").Snippet;
  }

  let { type = "", variant = "default", class: className = "", children }: Props = $props();

  const badgeType = $derived(type || "");
  const colors = $derived(getBadgeColors(badgeType));
  const variantClasses = $derived(getBadgeVariantClasses(variant));

  // Combine classes - if colors.text is provided (Tailwind), use it; otherwise use variant classes
  const badgeClasses = $derived(
    colors.text
      ? `${variantClasses} ${colors.bg} ${colors.text} ${className}`
      : `${variantClasses} ${colors.bg} ${className}`,
  );
</script>

<span class={badgeClasses}>
  {@render children()}
</span>





