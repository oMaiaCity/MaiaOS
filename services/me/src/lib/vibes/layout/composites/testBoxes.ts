/**
 * Shared Test Boxes
 * Reusable colored boxes for testing layouts
 */

import type { ViewNode } from '../../../compositor/view/types'

const colors = [
	{ bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700', label: 'Item 1' },
	{ bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700', label: 'Item 2' },
	{ bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700', label: 'Item 3' },
	{ bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-700', label: 'Item 4' },
	{ bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700', label: 'Item 5' },
	{ bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-700', label: 'Item 6' },
]

export function createTestBoxes(): ViewNode[] {
	return colors.map((color, index) => ({
		slot: `box${index + 1}`,
		leaf: {
			tag: 'div',
			classes: [
				color.bg,
				'border',
				color.border,
				'rounded-2xl',
				'p-4',
				'flex',
				'items-center',
				'justify-center',
				'min-h-[150px]',
				'min-w-[200px]', // For row layout
			],
			children: [
				{
					tag: 'span',
					classes: [color.text, 'font-medium'],
					children: [color.label],
				},
			],
		},
	}))
}

