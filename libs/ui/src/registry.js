import { button } from './composites/button.js'
import { card } from './composites/card.js'
import { heading } from './composites/heading.js'
import { paragraph } from './composites/paragraph.js'
import * as row from './composites/row.js'
import { section } from './composites/section.js'
import * as stack from './composites/stack.js'
import * as rect from './leaves/rect.js'
import * as text from './leaves/text.js'

/**
 * The one registry. Every entry is either:
 *   - a leaf              → `{ measure, paint }`
 *   - a built-in composite → `{ measure, layout, paint }`
 *   - a template composite → `{ template, variants? }`
 *
 * @typedef {{
 *   measure?: Function, layout?: Function, paint?: Function,
 *   template?: import('./kernel/node.js').Node,
 *   variants?: Record<string, Record<string, object>>,
 * }} RegistryEntry
 *
 * @type {Record<string, RegistryEntry>}
 */
export const registry = {
	// leaves (draw-only atoms)
	text: { measure: text.measure, paint: text.paint },
	rect: { measure: rect.measure, paint: rect.paint },

	// built-in composites (layout containers)
	stack: { measure: stack.measure, layout: stack.layout, paint: stack.paint },
	row: { measure: row.measure, layout: row.layout, paint: row.paint },

	// template composites (expand to built-ins + leaves)
	Heading: heading,
	Paragraph: paragraph,
	Button: button,
	Card: card,
	Section: section,
}

/**
 * @param {string} type
 * @param {Record<string, RegistryEntry>} [reg]
 */
export function isLeaf(type, reg = registry) {
	const e = reg[type]
	return !!e && e.template == null && e.layout == null
}

/**
 * @param {string} type
 * @param {Record<string, RegistryEntry>} [reg]
 */
export function isComposite(type, reg = registry) {
	const e = reg[type]
	return !!e && (!!e.template || !!e.layout)
}

/**
 * @param {string} type
 * @param {Record<string, RegistryEntry>} [reg]
 */
export function isTemplate(type, reg = registry) {
	const e = reg[type]
	return !!e && !!e.template
}
