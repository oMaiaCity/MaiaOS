<script>
    import { css, cx } from 'styled-system/css';

    // Svelte 5 Runes
    let { 
        size = 'md', 
        weight = 'medium',
        class: className,
        children, // Destructure to exclude from rest (avoid passing to css)
        ...rest 
    } = $props();
</script>

<span 
    class={cx(
        css({
            fontSize: size,
            fontWeight: weight,
            lineHeight: '1.2',
            ...rest
        }),
        className
    )}
>
    {#if typeof children === 'function'}
        {@render children()}
    {:else if children}
        {children}
    {/if}
</span>
