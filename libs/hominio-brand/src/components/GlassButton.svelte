<script>
	/**
	 * GlassButton - Reusable glass button component with Liquid Glass styling
	 * @typedef {Object} Props
	 * @property {boolean} disabled - Disabled state
	 * @property {'default' | 'navy' | 'danger'} variant - Button variant
	 *   - 'default': Light glass button (white/transparent)
	 *   - 'navy': Brand navy dark blue glass button (primary)
	 *   - 'danger': Red glass button for destructive actions
	 * @property {string} class - Additional CSS classes
	 * @property {string} type - Button type (default: 'button')
	 */
	
	let { 
		disabled = false,
		variant = 'navy', // Changed default to navy for brand consistency
		class: className = '',
		type = 'button',
		onclick,
		children,
		...restProps
	} = $props();
	
	// Use CSS utility classes from app.css for consistency
	const baseClass = 'glass-button';
	const variantClass = variant === 'navy'
		? 'glass-button-navy'
		: variant === 'danger'
			? 'glass-button-danger'
			: '';
	
	const classes = `${baseClass} ${variantClass} ${className}`.trim();
</script>

<button class={classes} type={type} disabled={disabled} onclick={onclick} {...restProps}>
	{@render children()}
</button>

