<script>
	/**
	 * GlassCard - Reusable glass card component with Liquid Glass styling
	 * @typedef {Object} Props
	 * @property {boolean} hover - Enable hover effects (default: true, always enabled via CSS)
	 * @property {boolean} lifted - Enable lift effect on hover (default: false)
	 * @property {boolean} accent - Show gradient accent header (default: false)
	 * @property {'alert'|'success'|'warning'|'accent'|null} bgColor - Background color variant (default: null)
	 * @property {string} class - Additional CSS classes
	 */
	
	let { 
		hover = true, // Kept for API compatibility, but CSS always has hover
		lifted = false,
		accent = false,
		bgColor = null, // 'alert' | 'success' | 'warning' | 'accent' | null
		class: className = '',
		children,
		...restProps
	} = $props();
	
	// Use CSS utility classes from app.css for consistency
	// Both glass-card and glass-card-lifted have hover effects built-in
	const baseClass = lifted ? 'glass-card-lifted' : 'glass-card';
	
	// Add bgColor class if provided
	const bgColorClass = bgColor ? `glass-card-bg-${bgColor}` : '';
	
	const classes = `${baseClass} ${bgColorClass} ${className}`.trim();
</script>

<div class={classes} {...restProps}>
	{#if accent}
		<!-- Gradient Accent Header -->
		<div class="h-24 w-full bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 opacity-50"></div>
	{/if}
	{@render children()}
</div>

<style>
	/* Override background color when bgColor prop is set - using !important to override base class */
	:global(.glass-card.glass-card-bg-alert),
	:global(.glass-card-lifted.glass-card-bg-alert) {
		background-color: var(--color-alert-100) !important;
	}
	
	:global(.glass-card.glass-card-bg-alert:hover),
	:global(.glass-card-lifted.glass-card-bg-alert:hover) {
		background-color: var(--color-alert-100) !important;
	}
	
	:global(.glass-card-bg-success),
	:global(.glass-card-lifted.glass-card-bg-success) {
		background-color: var(--color-success-50) !important;
	}
	
	:global(.glass-card-bg-success:hover),
	:global(.glass-card-lifted.glass-card-bg-success:hover) {
		background-color: var(--color-success-50) !important;
	}
	
	:global(.glass-card-bg-warning),
	:global(.glass-card-lifted.glass-card-bg-warning) {
		background-color: var(--color-warning-100) !important;
	}
	
	:global(.glass-card-bg-warning:hover),
	:global(.glass-card-lifted.glass-card-bg-warning:hover) {
		background-color: var(--color-warning-100) !important;
	}
	
	:global(.glass-card-bg-accent),
	:global(.glass-card-lifted.glass-card-bg-accent) {
		background-color: var(--color-accent-100) !important;
	}
	
	:global(.glass-card-bg-accent:hover),
	:global(.glass-card-lifted.glass-card-bg-accent:hover) {
		background-color: var(--color-accent-100) !important;
	}
</style>

