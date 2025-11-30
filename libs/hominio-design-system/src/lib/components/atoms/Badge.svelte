<script>
    import { css, cx } from 'styled-system/css';

    export let variant = 'primary'; // 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'alert' | 'info' | 'slate'
    export let size = 'sm'; // 'xs' | 'sm' | 'md' | 'lg'
    export let rounded = 'full'; // 'xs' | 'sm' | 'md' | 'lg' | 'full'

    const baseStyle = css({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'semibold',
        whiteSpace: 'nowrap',
        transition: 'all 200ms'
    });

    const sizeStyles = {
        xs: css({
            fontSize: 'xs',
            px: '2',
            py: '0.5',
            minH: '5'
        }),
        sm: css({
            fontSize: 'sm',
            px: '2.5',
            py: '1',
            minH: '6'
        }),
        md: css({
            fontSize: 'md',
            px: '3',
            py: '1.5',
            minH: '7'
        }),
        lg: css({
            fontSize: 'lg',
            px: '4',
            py: '2',
            minH: '8'
        })
    };

    const variantStyles = {
        primary: css({
            bg: 'primary.500',
            color: 'primary.50'
        }),
        secondary: css({
            bg: 'secondary.500',
            color: 'secondary.900'
        }),
        accent: css({
            bg: 'accent.500',
            color: 'accent.900'
        }),
        success: css({
            bg: 'success.500',
            color: 'success.50'
        }),
        warning: css({
            bg: 'warning.500',
            color: 'warning.900'
        }),
        alert: css({
            bg: 'alert.500',
            color: 'alert.50'
        }),
        info: css({
            bg: 'info.500',
            color: 'info.50'
        }),
        slate: css({
            bg: 'slate.500',
            color: 'slate.900'
        })
    };

    const roundedStyles = {
        xs: css({ rounded: 'xs' }),
        sm: css({ rounded: 'sm' }),
        md: css({ rounded: 'md' }),
        lg: css({ rounded: 'lg' }),
        full: css({ rounded: 'full' })
    };
</script>

<span 
    class={cx(
        baseStyle,
        sizeStyles[size],
        variantStyles[variant],
        roundedStyles[rounded]
    )}
>
    <slot />
</span>

