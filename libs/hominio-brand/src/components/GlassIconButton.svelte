<script>
	/**
	 * GlassIconButton - Icon button with glass styling
	 * @typedef {Object} Props
	 * @property {boolean} disabled - Disabled state
	 * @property {'default'|'danger'} variant - Button variant
	 * @property {string} size - Size ('sm' | 'md' | 'lg')
	 * @property {string} class - Additional CSS classes
	 */
	
	let { 
		disabled = false,
		variant = 'default',
		size = 'md',
		class: className = '',
		type = 'button',
		onclick,
		children,
		...restProps
	} = $props();
	
	const sizeClasses = {
		sm: 'h-7 w-7',
		md: 'h-9 w-9',
		lg: 'h-11 w-11',
	};
	
	// Use CSS utility class from app.css
	const baseClass = 'glass-icon-button';
	const variantClass = variant === 'danger' ? 'glass-icon-button-danger' : '';
	const disabledClass = disabled ? 'cursor-not-allowed opacity-60' : '';
	
	const classes = `${baseClass} ${variantClass} ${sizeClasses[size]} text-slate-600 hover:text-slate-900 ${disabledClass} ${className}`.trim();
</script>

<button class={classes} type={type} disabled={disabled} onclick={onclick} {...restProps}>
	{@render children()}
</button>

