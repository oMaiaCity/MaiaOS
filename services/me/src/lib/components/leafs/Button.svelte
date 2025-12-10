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

  const buttonClasses = $derived(() => {
    const variantClass = `button-${variant}`;
    const sizeClass = `button-${size}`;
    return `${variantClass} ${sizeClass} ${className}`.trim();
  });
</script>

<button {type} {onclick} {disabled} class={buttonClasses()}>
  {@render children()}
</button>

