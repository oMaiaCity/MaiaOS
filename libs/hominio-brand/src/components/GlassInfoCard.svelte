<script>
	/**
	 * GlassInfoCard - Small info card with glass styling (for profile info, etc.)
	 * @typedef {Object} Props
	 * @property {string} class - Additional CSS classes
	 */
	
	let { 
		class: className = '',
		...restProps
	} = $props();
	
	// Use CSS utility class from app.css
	const baseClass = 'glass-info-card';
	const classes = `${baseClass} ${className}`.trim();
</script>

<div class={classes} {...restProps}>
	<slot />
</div>

