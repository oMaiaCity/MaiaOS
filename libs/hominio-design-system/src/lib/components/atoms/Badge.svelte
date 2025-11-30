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

    const sizeStyles = {
        xs: css({ fontSize: 'xs', px: '2', py: '0.5', minH: '5' }),
        sm: css({ fontSize: 'sm', px: '2.5', py: '1', minH: '6' }),
        md: css({ fontSize: 'md', px: '3', py: '1.5', minH: '7' }),
        lg: css({ fontSize: 'lg', px: '4', py: '2', minH: '8' })
    };

    const variantStyles = {
        primary: css({ bg: 'primary.100', color: 'primary.700', borderColor: 'primary.200' }),
        secondary: css({ bg: 'secondary.100', color: 'secondary.800', borderColor: 'secondary.200' }),
        accent: css({ bg: 'accent.100', color: 'accent.800', borderColor: 'accent.200' }),
        success: css({ bg: 'success.100', color: 'success.800', borderColor: 'success.200' }),
        warning: css({ bg: 'warning.100', color: 'warning.800', borderColor: 'warning.200' }),
        alert: css({ bg: 'alert.100', color: 'alert.800', borderColor: 'alert.200' }),
        info: css({ bg: 'info.100', color: 'info.800', borderColor: 'info.200' }),
        slate: css({ bg: 'slate.100', color: 'slate.700', borderColor: 'slate.200' })
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
    tabindex={onClick ? 0 : undefined}
    onclick={handleClick}
    onkeydown={handleKeydown}
>
    <slot />
</span>
