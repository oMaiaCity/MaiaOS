<script>
    import { css, cx } from 'styled-system/css';

    // Svelte 5 Runes
    let { 
        variant = 'primary', 
        size = 'sm', 
        rounded = 'full', 
        onClick,
        class: className,
        children, // Destructure to exclude but not use directly in rest
        ...rest
    } = $props();

    let baseStyle = $derived(css({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'semibold',
        whiteSpace: 'nowrap',
        transition: 'all 200ms',
        borderWidth: '1px',
        lineHeight: '1',
        ...(onClick ? { cursor: 'pointer', _hover: { opacity: 0.8 } } : {}),
        ...rest
    }));

    // Map size to one smaller text size for badges
    const textSizeMap = {
        xs: 'xs', // Keep xs as is (smallest)
        sm: 'xs',  // sm -> xs
        md: 'sm',  // md -> sm
        lg: 'md'   // lg -> md
    };

    let textSize = $derived(textSizeMap[size] || 'xs');

    const sizeStyles = {
        xs: css({ fontSize: textSize, px: '2', py: '0.5', minH: '5' }),
        sm: css({ fontSize: textSize, px: '2.5', py: '1', minH: '6' }),
        md: css({ fontSize: textSize, px: '3', py: '1.5', minH: '7' }),
        lg: css({ fontSize: textSize, px: '4', py: '2', minH: '8' })
    };

    const variantStyles = {
        primary: css({ bg: 'primary.300', color: 'primary.700', borderColor: 'primary.400' }),
        secondary: css({ bg: 'secondary.300', color: 'secondary.800', borderColor: 'secondary.400' }),
        accent: css({ bg: 'accent.300', color: 'accent.800', borderColor: 'accent.400' }),
        success: css({ bg: 'success.300', color: 'success.800', borderColor: 'success.400' }),
        warning: css({ bg: 'warning.300', color: 'warning.800', borderColor: 'warning.400' }),
        alert: css({ bg: 'alert.300', color: 'alert.800', borderColor: 'alert.400' }),
        info: css({ bg: 'info.300', color: 'info.800', borderColor: 'info.400' }),
        slate: css({ bg: 'slate.300', color: 'slate.700', borderColor: 'slate.400' })
    };

    const roundedStyles = {
        xs: css({ rounded: 'xs' }),
        sm: css({ rounded: 'sm' }),
        md: css({ rounded: 'md' }),
        lg: css({ rounded: 'lg' }),
        full: css({ rounded: 'full' })
    };
    
    // Handle events safely in Svelte 5
    function handleClick(e) {
        if (onClick) onClick(e);
    }
    
    function handleKeydown(e) {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick(e);
        }
    }
</script>

<span 
    class={cx(
        baseStyle,
        sizeStyles[size] || sizeStyles.sm,
        variantStyles[variant] || variantStyles.primary,
        roundedStyles[rounded] || roundedStyles.full,
        className
    )}
    role={onClick ? 'button' : undefined}
    {...(onClick ? { tabindex: 0 } : {})}
    onclick={handleClick}
    onkeydown={handleKeydown}
>
    {#if typeof children === 'function'}
        {@render children()}
    {:else if children}
        {children}
    {/if}
</span>
