<script>
	import { css, cx } from 'styled-system/css';
    import Icon from '@iconify/svelte';

    // Svelte 5 Runes
    let {
        size = 'md',
        color = 'slate.500', // Default token
        label = '',
        icon,
        onClick,
        class: className,
        ...rest
    } = $props();

    const sizeMap = {
        sm: css({ w: '8', h: '8', fontSize: 'lg' }),
        md: css({ w: '10', h: '10', fontSize: 'xl' }),
        lg: css({ w: '12', h: '12', fontSize: '2xl' })
    };

    let finalSizeClass = $derived(typeof size === 'string' && sizeMap[size] ? sizeMap[size] : size);
    
    // Generate color class dynamically
    // We assume 'color' is a token (e.g. 'success.500') or a raw CSS value
    let colorClass = $derived(css({ color: color }));

	const glassIconButtonStyle = css({
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 'button',
		border: 'none',
		bg: 'transparent',
		transition: 'all 200ms',
		cursor: 'pointer',
		_hover: { bg: 'black/5' }, 
		_active: { transform: 'scale(0.95)' },
		_disabled: { cursor: 'not-allowed', opacity: 0.6 }
	});

    function handleClick(e) {
        if (onClick) onClick(e);
    }
</script>

<button 
    class={cx(glassIconButtonStyle, finalSizeClass, colorClass, className)} 
    aria-label={label}
    onclick={handleClick}
    {...rest}
>
    {#if icon}
        <Icon {icon} />
    {/if}
    <slot />
</button>
