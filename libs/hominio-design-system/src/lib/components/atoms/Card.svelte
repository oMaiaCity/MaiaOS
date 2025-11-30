<script>
	import { css, cx } from 'styled-system/css';

	export let padding = '6';
	export let rounded = 'card';
	export let bg = 'light.50'; // Default background
	export let shadow = 'none'; // No shadow for liquid glass effect
	export let border = true;
	export let borderColor = 'glass.border.default'; // Use semantic glass border token
	export let glass = true; // Enable liquid glass effect
	export let className = '';
</script>

<div 
	class={cx(
		css({
			p: padding,
			rounded: rounded,
			bg: bg,
			boxShadow: shadow,
			borderWidth: border ? '1px' : '0',
			borderColor: borderColor,
			backdropFilter: glass ? 'blur(24px)' : 'none',
			overflow: 'hidden',
			display: 'flex',
			flexDirection: 'column',
			width: '100%',
			transition: 'all 0.5s'
		}),
		className
	)}
>
	<slot />
</div>

