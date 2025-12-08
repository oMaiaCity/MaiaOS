<script>
	/**
	 * GlassInfoCard - Small info card with glass styling (for profile info, etc.)
	 * @typedef {Object} Props
	 * @property {string} class - Additional CSS classes
	 */
	
	let { 
		class: className = '',
		children,
		...restProps
	} = $props();
	
	// Use CSS utility class from app.css
	const baseClass = 'glass-info-card';
	const classes = $derived(`${baseClass} ${className}`.trim());
</script>

<div class={classes} {...restProps}>
	{@render children()}
</div>

