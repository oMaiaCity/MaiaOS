<script lang="ts">
  interface Props {
    variant?: "primary" | "secondary" | "ghost";
    size?: "sm" | "md" | "lg";
    class?: string;
    type?: "button" | "submit" | "reset";
    onclick?: () => void;
    disabled?: boolean;
    children: import("svelte").Snippet;
  }

  let {
    variant = "primary",
    size = "md",
    class: className = "",
    type = "button",
    onclick,
    disabled = false,
    children,
  }: Props = $props();

  // Base button classes
  const baseClasses =
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed";

  // Variant classes
  const variantClasses = {
    primary:
      "bg-[#001a42] border border-[#001a42] text-[#e6ecf7] shadow-[0_0_6px_rgba(0,0,0,0.15)] hover:bg-[#002662] hover:border-[#002662] hover:shadow-[0_0_8px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98]",
    secondary:
      "bg-slate-100 border border-white text-slate-700 shadow-[0_0_4px_rgba(0,0,0,0.02)] hover:bg-slate-200 hover:border-slate-300",
    ghost:
      "bg-white/50 border border-white text-slate-600 hover:text-slate-700 hover:bg-white/70",
  };

  // Size classes
  const sizeClasses = {
    sm: "py-1 px-3 text-xs",
    md: "py-1.5 px-4 text-sm",
    lg: "py-2 px-6 text-base",
  };

  const buttonClasses = $derived(
    `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`,
  );
</script>

<button {type} {onclick} {disabled} class={buttonClasses}>
  {@render children()}
</button>

