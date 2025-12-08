<script>
	/**
	 * GlassButton - Reusable glass button component with Liquid Glass styling
	 * @typedef {Object} Props
	 * @property {boolean} disabled - Disabled state
	 * @property {'default' | 'navy' | 'danger' | 'alert'} variant - Button variant
	 *   - 'default': Light glass button (white/transparent)
	 *   - 'navy': Brand navy dark blue glass button (primary)
	 *   - 'danger': Red glass button for destructive actions
	 *   - 'alert': Alert purple/magenta glass button
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
	const variantClass = $derived(variant === 'navy'
		? 'glass-button-navy'
		: variant === 'danger'
			? 'glass-button-danger'
			: variant === 'alert'
				? 'glass-button-alert'
				: '');
	
	const classes = $derived(`${baseClass} ${variantClass} ${className}`.trim());
</script>

<button class={classes} type={type} disabled={disabled} onclick={onclick} {...restProps}>
	{@render children()}
</button>

