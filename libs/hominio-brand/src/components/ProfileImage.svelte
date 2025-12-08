<script>
	/**
	 * ProfileImage - Profile image with glass frame
	 * @typedef {Object} Props
	 * @property {string} src - Image source URL
	 * @property {string} alt - Alt text
	 * @property {string} name - Name for fallback initial
	 * @property {string} email - Email for fallback initial
	 * @property {string} size - Size ('sm' | 'md' | 'lg' | 'xl')
	 * @property {string} class - Additional CSS classes
	 */
	
	let { 
		src,
		alt = 'Profile',
		name = '',
		email = '',
		size = 'lg',
		class: className = '',
		...restProps
	} = $props();
	
	const sizeClasses = {
		sm: 'h-16 w-16',
		md: 'h-24 w-24',
		lg: 'h-32 w-32',
		xl: 'h-40 w-40',
	};
	
	const textSizeClasses = {
		sm: 'text-2xl',
		md: 'text-3xl',
		lg: 'text-5xl',
		xl: 'text-6xl',
	};
	
	const frameClasses = $derived(`relative rounded-full p-1 bg-white/80 shadow-lg backdrop-blur-sm ${sizeClasses[size]}`);
	const imageClasses = $derived(`${sizeClasses[size]} rounded-full object-cover`);
	const fallbackClasses = $derived(`flex ${sizeClasses[size]} items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 font-medium text-slate-500 ${textSizeClasses[size]}`);
	
	const initial = $derived((name || email || 'U')[0].toUpperCase());
</script>

<div class={frameClasses}>
	{#if src}
		<img
			src={src}
			alt={alt}
			class={imageClasses}
			referrerpolicy="no-referrer"
			{...restProps}
		/>
	{:else}
		<div class={fallbackClasses}>
			{initial}
		</div>
	{/if}
</div>

