/**
 * Utility class generators for Liquid Glass design system
 * Use these when you can't use Svelte components
 */

/**
 * Generate glass card classes
 * @param {Object} options - Options for glass card
 * @param {boolean} options.hover - Enable hover effects
 * @param {boolean} options.lifted - Enable lift effect on hover
 * @returns {string} Tailwind classes
 */
export function glassCard({ hover = true, lifted = false } = {}) {
	let classes =
		'overflow-hidden rounded-3xl border border-white/60 bg-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-500'

	if (lifted) {
		classes +=
			' hover:-translate-y-1 hover:border-white/80 hover:bg-white/50 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] active:translate-y-0'
	} else if (hover) {
		classes += ' hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]'
	}

	return classes
}

/**
 * Generate glass button classes
 * @param {Object} options - Options for glass button
 * @param {boolean} options.disabled - Disabled state
 * @returns {string} Tailwind classes
 */
export function glassButton({ disabled = false } = {}) {
	let classes =
		'rounded-xl border border-white/60 bg-white/40 px-6 py-3 font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-all hover:border-white/80 hover:bg-white/50 hover:shadow-md active:scale-95'

	if (disabled) {
		classes += ' cursor-not-allowed opacity-60'
	}

	return classes
}

/**
 * Generate background gradient classes
 * @returns {string} Tailwind classes
 */
export function bgGlassGradient() {
	return 'bg-gradient-to-br from-[#f8f9fa] via-[#f2f4f6] to-[#e9ecef]'
}

/**
 * Generate alert classes
 * @param {'warning'|'error'} type - Alert type
 * @returns {string} Tailwind classes
 */
export function alert(type = 'warning') {
	const baseClasses = 'rounded-2xl p-6 backdrop-blur-md'

	if (type === 'error') {
		return `${baseClasses} border border-red-100 bg-red-50/50 text-red-600`
	}

	return `${baseClasses} border border-yellow-100 bg-yellow-50/50 text-yellow-600`
}

/**
 * Generate decorative blob classes
 * @param {'blue'|'purple'|'emerald'} color - Blob color
 * @param {Object} options - Options for blob
 * @param {string} options.position - Position classes (e.g., 'fixed -top-[20%] -left-[10%]')
 * @param {string} options.size - Size classes (e.g., 'h-[500px] w-[500px]')
 * @returns {string} Tailwind classes
 */
export function decorativeBlob(
	color = 'blue',
	{ position = '', size = 'h-[500px] w-[500px]' } = {},
) {
	const colorMap = {
		blue: 'bg-blue-200/20',
		purple: 'bg-purple-200/20',
		emerald: 'bg-emerald-200/20',
	}

	const baseClasses = `${position} ${size} rounded-full ${colorMap[color]} blur-3xl filter pointer-events-none`
	return baseClasses.trim()
}

/**
 * Generate loading spinner classes
 * @param {Object} options - Options for spinner
 * @param {'default'|'white'} options.variant - Spinner variant
 * @returns {string} Tailwind classes
 */
export function loadingSpinner({ variant = 'default' } = {}) {
	if (variant === 'white') {
		return 'h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-cyan-400'
	}
	return 'h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800'
}
