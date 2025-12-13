/**
 * Badge Utilities - Composable functions for badge styling
 * Maps badge types to CSS theme classes
 */

export interface BadgeColors {
	bg: string
	text: string
}

/**
 * Get badge color classes based on type
 * Returns CSS class names that use theme variables
 */
export function getBadgeColors(typeName: string): BadgeColors {
	// Handle undefined, null, or non-string values
	if (!typeName || typeof typeName !== 'string') {
		return { bg: 'badge-default-color', text: '' }
	}
	const normalized = typeName.toLowerCase()

	switch (normalized) {
		// Primitive types
		case 'primitive':
			return { bg: 'badge-string', text: '' } // Use string badge style for primitives
		case 'string':
			return { bg: 'badge-string', text: '' }
		case 'number':
			return { bg: 'badge-number', text: '' }
		case 'boolean':
			return { bg: 'badge-boolean', text: '' }
		case 'date':
			return { bg: 'badge-date', text: '' } // Dedicated date badge style
		case 'enum':
			return { bg: 'badge-enum', text: '' } // Dedicated enum badge style
		case 'array':
			return { bg: 'badge-array', text: '' }
		case 'object':
			return { bg: 'badge-object', text: '' }

		// CoValue types
		case 'image':
		case 'imagedefinition':
			return { bg: 'badge-image', text: '' }
		case 'filestream':
			return { bg: 'badge-filestream', text: '' }
		case 'comap':
			return { bg: 'badge-comap', text: '' }
		case 'colist':
			return { bg: 'badge-colist', text: '' }
		case 'cofeed':
			return { bg: 'bg-orange-100', text: 'text-orange-800' }
		case 'coplaintext':
			return { bg: 'bg-teal-100', text: 'text-teal-800' }
		case 'corichtext':
			return { bg: 'bg-cyan-100', text: 'text-cyan-800' }
		case 'covalue':
			return { bg: 'badge-covalue', text: '' }

		// Status types
		case 'complete':
		case 'finished':
			return { bg: 'badge-complete', text: '' }
		case 'loading':
		case 'uploading':
			return { bg: 'badge-loading', text: '' }

		// Role types
		case 'admin':
			return { bg: 'badge-admin', text: '' }
		case 'reader':
			return { bg: 'badge-reader', text: '' }

		// Special types
		case 'computed':
			return { bg: 'badge-computed', text: '' }

		// Default
		default:
			return { bg: 'badge-default-color', text: '' }
	}
}

/**
 * Get variant-specific badge classes
 */
export function getBadgeVariantClasses(variant: 'default' | 'compact' | 'role'): string {
	switch (variant) {
		case 'compact':
			return 'badge-compact'
		case 'role':
			return 'badge-role'
		default:
			return 'badge-default'
	}
}
