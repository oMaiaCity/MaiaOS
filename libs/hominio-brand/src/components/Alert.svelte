<script>
	/**
	 * Alert - Alert/error card component with glass styling
	 * @typedef {Object} Props
	 * @property {'warning'|'error'} type - Alert type
	 * @property {string} class - Additional CSS classes
	 */
	
	let { 
		type = 'warning',
		class: className = '',
		children,
		...restProps
	} = $props();
	
	const baseClasses = 'rounded-2xl p-6 backdrop-blur-md';
	
	const typeClasses = $derived(type === 'error'
		? 'border border-red-100 bg-red-50/50 text-red-600'
		: 'border border-yellow-100 bg-yellow-50/50 text-yellow-600');
	
	const classes = $derived(`${baseClasses} ${typeClasses} ${className}`.trim());
</script>

<div class={classes} {...restProps}>
	{@render children()}
</div>

