<script>
	/**
	 * DarkGlassCard - Glass card with dark theme (for dark backgrounds)
	 * @typedef {Object} Props
	 * @property {boolean} hover - Enable hover effects
	 * @property {string} class - Additional CSS classes
	 */
	
	let { 
		hover = true,
		class: className = '',
		...restProps
	} = $props();
	
	const baseClasses = 'rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm transition-all';
	const hoverClasses = hover ? 'hover:bg-white/10 hover:border-white/20' : '';
	
	const classes = `${baseClasses} ${hoverClasses} ${className}`.trim();
</script>

<div class={classes} {...restProps}>
	<slot />
</div>

