<script>
	import { css } from 'styled-system/css';
	export let initials = 'SA';
</script>

<!-- Fully rounded circle placeholder -->
<div class={css({
	w: 'full',
	h: 'full',
	rounded: 'full',
	bgGradient: 'to-br',
	gradientFrom: 'primary.800',
	gradientTo: 'primary.600',
	border: '1px solid token(colors.white/20)',
	shadow: 'inner',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	overflow: 'hidden',
	opacity: '1',
	backdropFilter: 'none'
})}>
    <span class={css({ fontSize: '[10px]', fontWeight: 'bold', color: 'primary.100' })}>{initials}</span>
</div>

