<script>
    import { css, cx } from 'styled-system/css';
    import Icon from '@iconify/svelte';

    // Svelte 5 Runes
    let {
        variant = 'primary',
        size = 'md',
        rounded = 'full',
        icon,
        iconPosition = 'left',
        disabled = false,
        loading = false,
        type = 'button',
        fullWidth = false,
        onClick = () => {},
        state = 'inactive',
        class: className = '',
        children,
        ...rest
    } = $props();

    // Base Styles
    const baseStyles = css({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'medium',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderWidth: '1px',
        outline: 'none',
        _disabled: {
            opacity: 0.6,
            cursor: 'not-allowed',
            boxShadow: 'none'
        },
        _active: {
            transform: 'scale(0.98)'
        }
    });

    // Variant Styles
    const variantStyles = {
        primary: css({ bg: 'primary.500', color: 'primary.50', borderColor: 'primary.600', _hover: { bg: 'primary.600' } }),
        secondary: css({ bg: 'secondary.500', color: 'white', borderColor: 'secondary.600', _hover: { bg: 'secondary.600' } }),
        accent: css({ bg: 'accent.500', color: 'accent.900', borderColor: 'accent.600', _hover: { bg: 'accent.600' } }),
        success: css({ bg: 'success.500', color: 'white', borderColor: 'success.600', _hover: { bg: 'success.600' } }),
        warning: css({ bg: 'warning.500', color: 'white', borderColor: 'warning.600', _hover: { bg: 'warning.600' } }),
        alert: css({ bg: 'alert.500', color: 'white', borderColor: 'alert.600', _hover: { bg: 'alert.600' } }),
        info: css({ bg: 'info.500', color: 'white', borderColor: 'info.600', _hover: { bg: 'info.600' } }),
        slate: css({ bg: 'slate.100', color: 'slate.900', borderColor: 'slate.200', _hover: { bg: 'slate.200' } }),
        glass: css({ 
            bg: 'white/20', 
            backdropFilter: 'blur(12px)', 
            borderColor: 'white/30', 
            color: 'slate.900', 
            _hover: { bg: 'white/30' } 
        }),
        ghost: css({ bg: 'transparent', color: 'slate.600', borderColor: 'transparent', _hover: { bg: 'slate.100' } }),
        outline: css({ bg: 'transparent', borderWidth: '1px', borderColor: 'slate.300', color: 'slate.700', _hover: { bg: 'slate.50' } })
    };

    // Size Styles
    const sizeStyles = {
        sm: css({ h: '8', px: '3', fontSize: 'xs', gap: '1.5' }),
        md: css({ h: '10', px: '4', fontSize: 'sm', gap: '2' }),
        lg: css({ h: '12', px: '6', fontSize: 'base', gap: '2.5' }),
        xl: css({ h: '14', px: '8', fontSize: 'lg', gap: '3' }),
        iconOnly: {
            sm: css({ w: '8', h: '8', p: '0' }),
            md: css({ w: '10', h: '10', p: '0' }),
            lg: css({ w: '12', h: '12', p: '0' }),
            xl: css({ w: '14', h: '14', p: '0' })
        }
    };

    // Rounded Styles
    const roundedStyles = {
        full: css({ rounded: 'full' }),
        lg: css({ rounded: 'lg' }),
        md: css({ rounded: 'md' }),
        sm: css({ rounded: 'sm' }),
        none: css({ rounded: 'none' })
    };

    // Computed Classes
    let isIconOnly = $derived(icon && !children);
    let sizeClass = $derived(isIconOnly ? sizeStyles.iconOnly[size] : sizeStyles[size]);
    let widthClass = $derived(fullWidth ? css({ w: 'full' }) : '');
    let stateClass = $derived(state === 'active' ? css({ ring: '2px', ringColor: 'accent.500', ringOffset: '2px' }) : '');

    function handleClick(e) {
        if (!disabled && !loading) {
            onClick(e);
        }
    }

</script>

<button
    {type}
    class={cx(
        baseStyles, 
        variantStyles[variant] || variantStyles.primary, 
        sizeClass, 
        roundedStyles[rounded], 
        widthClass,
        stateClass,
        className,
        css(rest)
    )}
    {disabled}
    onclick={handleClick}
>
    {#if loading}
        <Icon icon="svg-spinners:ring-resize" class={css({ fontSize: '1.2em' })} />
    {:else}
        {#if icon && iconPosition === 'left'}
            <Icon {icon} class={css({ fontSize: '1.2em' })} />
        {/if}
        
        {#if typeof children === 'function'}
            <span>{@render children()}</span>
        {:else if children}
            <span>{children}</span>
        {/if}

        {#if icon && iconPosition === 'right'}
            <Icon {icon} class={css({ fontSize: '1.2em' })} />
        {/if}
    {/if}
</button>
