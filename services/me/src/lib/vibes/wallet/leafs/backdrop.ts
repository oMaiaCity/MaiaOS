/**
 * Backdrop Blur Leaf Component
 * Shows a blurred background when the send form is open
 */

import type { LeafNode } from '../../../compositor/view/leaf-types'

export const backdropLeaf: LeafNode = {
	tag: 'div',
	classes: [
		'absolute',
		'inset-0',
		'w-full',
		'h-full',
		'backdrop-blur-sm',
		'transition-opacity',
		'duration-300',
		'z-[1]',
		'pointer-events-none',
	],
	bindings: {
		visible: 'data.showSendModal',
	},
}
