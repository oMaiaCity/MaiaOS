<script>
	/**
	 * GlassPill - Glass navigation pill component (for bottom nav bars)
	 * @typedef {Object} Props
	 * @property {string} class - Additional CSS classes
	 */
	
	let { 
		class: className = '',
		children,
		...restProps
	} = $props();
	
	// Use CSS utility class from app.css
	const baseClass = 'glass-pill-nav';
	const classes = $derived(`${baseClass} ${className}`.trim());
</script>

<nav class={classes} {...restProps}>
	{@render children()}
</nav>

