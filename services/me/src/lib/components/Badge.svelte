<script lang="ts">
  interface Props {
    type?: string; // Type name (e.g., "string", "CoList", "Image") - will auto-map to color
    variant?: "default" | "compact" | "role"; // Badge style variant
    class?: string; // Additional classes
    children: import("svelte").Snippet; // Badge content (usually the type name)
  }

  let { type, variant = "default", class: className = "", children }: Props = $props();

  // Get badge color classes based on type
  function getBadgeColors(typeName: string): { bg: string; text: string } {
    const normalized = typeName.toLowerCase();
    
    switch (normalized) {
      // Primitive types
      case "string":
        return { bg: "bg-blue-50", text: "text-blue-700" };
      case "number":
        return { bg: "bg-purple-50", text: "text-purple-700" };
      case "boolean":
        return { bg: "bg-green-50", text: "text-green-700" };
      case "array":
        return { bg: "bg-cyan-50", text: "text-cyan-700" };
      case "object":
        return { bg: "bg-amber-50", text: "text-amber-700" };
      
      // CoValue types
      case "image":
      case "imagedefinition":
        return { bg: "bg-green-100", text: "text-green-700" };
      case "filestream":
        return { bg: "bg-orange-100", text: "text-orange-700" };
      case "comap":
        return { bg: "bg-purple-100", text: "text-purple-700" };
      case "colist":
        return { bg: "bg-blue-100", text: "text-blue-700" };
      case "covalue":
        return { bg: "bg-purple-100", text: "text-purple-700" };
      
      // Status types
      case "complete":
      case "finished":
        return { bg: "bg-green-100", text: "text-green-700" };
      case "loading":
      case "uploading":
        return { bg: "bg-yellow-100", text: "text-yellow-700" };
      
      // Role types
      case "admin":
        return { bg: "bg-yellow-100/50", text: "text-yellow-700" };
      case "reader":
        return { bg: "bg-red-100/50", text: "text-red-700" };
      
      // Special types
      case "computed":
        return { bg: "bg-slate-100", text: "text-slate-700" };
      
      // Default
      default:
        return { bg: "bg-slate-50/80", text: "text-slate-500" };
    }
  }

  // Get variant-specific classes
  function getVariantClasses(typeName: string): string {
    switch (variant) {
      case "compact":
        return "px-1.5 py-0.5 rounded text-xs";
      case "role":
        return "px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border border-white";
      case "default":
      default:
        return "px-2 py-0.5 rounded-full border border-white text-[10px] font-bold uppercase tracking-wider shrink-0";
    }
  }

  const badgeType = $derived(type || "");
  const colors = $derived(getBadgeColors(badgeType));
  const variantClasses = $derived(getVariantClasses(badgeType));
</script>

<span class="{variantClasses} {colors.bg} {colors.text} {className}">
  {@render children()}
</span>

