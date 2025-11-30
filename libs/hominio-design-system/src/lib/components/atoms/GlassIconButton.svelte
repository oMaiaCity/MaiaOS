<script>
	import { css, cx } from 'styled-system/css';

	export let size = css({ w: '12', h: '12' });
	export let color = css({ color: 'primary.200' });
	export let label = '';
    export let onClick = () => {};

	const glassIconButtonStyle = css({
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 'button',
		border: 'none',
		bg: 'transparent',
		transition: 'all 200ms',
		cursor: 'pointer',
		_hover: { bg: 'white/10' },
		_active: { transform: 'scale(0.95)' },
		_disabled: { cursor: 'not-allowed', opacity: 0.6 }
	});
</script>

<button 
    class={cx(glassIconButtonStyle, size, color)} 
    aria-label={label}
    on:click={onClick}
>
    <slot />
</button>

