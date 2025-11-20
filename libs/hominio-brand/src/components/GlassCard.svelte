<script>
	/**
	 * GlassCard - Reusable glass card component with Liquid Glass styling
	 * @typedef {Object} Props
	 * @property {boolean} hover - Enable hover effects (default: true, always enabled via CSS)
	 * @property {boolean} lifted - Enable lift effect on hover (default: false)
	 * @property {boolean} accent - Show gradient accent header (default: false)
	 * @property {string} class - Additional CSS classes
	 */
	
	let { 
		hover = true, // Kept for API compatibility, but CSS always has hover
		lifted = false,
		accent = false,
		class: className = '',
		...restProps
	} = $props();
	
	// Use CSS utility classes from app.css for consistency
	// Both glass-card and glass-card-lifted have hover effects built-in
	const baseClass = lifted ? 'glass-card-lifted' : 'glass-card';
	const classes = `${baseClass} ${className}`.trim();
</script>

<div class={classes} {...restProps}>
	{#if accent}
		<!-- Gradient Accent Header -->
		<div class="h-24 w-full bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 opacity-50"></div>
	{/if}
	<slot />
</div>

