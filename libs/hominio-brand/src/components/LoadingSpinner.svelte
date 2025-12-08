<script>
	/**
	 * LoadingSpinner - Standardized loading spinner component
	 * @typedef {Object} Props
	 * @property {'default'|'white'} variant - Spinner variant
	 * @property {string} size - Size class (default: 'h-12 w-12')
	 * @property {string} class - Additional CSS classes
	 */
	
	let { 
		variant = 'default',
		size = 'h-12 w-12',
		class: className = '',
	} = $props();
	
	const variantClasses = $derived(variant === 'white'
		? 'border-4 border-white/30 border-t-cyan-400'
		: 'border-4 border-slate-200 border-t-slate-800');
	
	const classes = $derived(`${size} animate-spin rounded-full ${variantClasses} ${className}`.trim());
</script>

<div class={classes}></div>

