<script>
	import { css, cx } from 'styled-system/css';

	// Svelte 5 Runes
	let {
		padding = '6',
		rounded = 'card',
		bg = 'slate.50',
		shadow = 'none',
		border = true,
		borderColor = 'glass.border.default',
		glass = true,
		class: className = '',
		children,
		...rest
	} = $props();
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
	{...rest}
>
	{#if typeof children === 'function'}
		{@render children()}
	{:else if children}
		{children}
	{/if}
</div>

