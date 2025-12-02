<script>
    import { css, cx } from 'styled-system/css';
    import Icon from '@iconify/svelte';

    // Svelte 5 Runes
    let { 
        variant = 'primary', 
        size = 'sm', 
        rounded = 'full', 
        icon,
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
        primary: css({ bg: 'primary.500', color: 'primary.50' }),
        secondary: css({ bg: 'secondary.500', color: 'secondary.50' }),
        accent: css({ bg: 'accent.500', color: 'accent.900' }),
        success: css({ bg: 'success.500', color: 'success.50' }),
        warning: css({ bg: 'warning.500', color: 'warning.50' }),
        alert: css({ bg: 'alert.500', color: 'alert.50' }),
        info: css({ bg: 'info.500', color: 'info.50' }),
        slate: css({ bg: 'slate.500', color: 'slate.50' })
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
    {#if icon}
        <Icon icon={icon} class={css({ mr: '1.5', fontSize: '1.1em' })} />
    {/if}
    {#if typeof children === 'function'}
        {@render children()}
    {:else if children}
        {children}
    {/if}
</span>
