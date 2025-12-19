/**
 * Leaf Builder - Helper functions to build common leaf patterns
 * Makes it easier to create leaves programmatically while still being JSON-serializable
 */

import type { LeafNode } from './leaf-types'

/**
 * Leaf builder utilities
 */
export const Leaves = {
	/**
	 * Create a button leaf
	 */
	button: (
		label: string,
		event: string,
		classes?: string,
		payload?: Record<string, unknown> | string,
	): LeafNode => ({
		tag: 'button',
		attributes: { type: 'button' },
		classes: classes || 'px-4 py-2 bg-blue-500 text-white rounded',
		events: { click: { event, payload } },
		elements: [label],
	}),

	/**
	 * Create an input leaf
	 */
	input: (
		binding: string,
		placeholder: string,
		inputEvent?: string,
		classes?: string,
	): LeafNode => ({
		tag: 'input',
		attributes: { type: 'text', placeholder },
		classes: classes || 'px-4 py-2 border rounded',
		bindings: { value: binding },
		events: inputEvent ? { input: { event: inputEvent } } : undefined,
	}),

	/**
	 * Create a text leaf
	 */
	text: (binding: string, tag = 'span', classes?: string): LeafNode => ({
		tag,
		classes,
		bindings: { text: binding },
	}),

	/**
	 * Create a conditional leaf (visible based on data path)
	 */
	conditional: (condition: string, leaf: LeafNode): LeafNode => ({
		...leaf,
		bindings: { ...leaf.bindings, visible: condition },
	}),

	/**
	 * Create a container div leaf (for HTML nesting only, not composition)
	 */
	container: (elements: (LeafNode | string)[], classes?: string): LeafNode => ({
		tag: 'div',
		classes: classes || '',
		elements,
	}),

	/**
	 * Create a heading leaf
	 */
	heading: (level: 1 | 2 | 3 | 4 | 5 | 6, binding: string, classes?: string): LeafNode => ({
		tag: `h${level}`,
		classes: classes || '',
		bindings: { text: binding },
	}),
}
