/**
 * Single source for catalog namekey extraction (definition CoMap content: title / $label).
 */

import { FACTORY_REF_PATTERN, INSTANCE_REF_PATTERN } from './patterns.js'

/**
 * @param {object|null|undefined} content - CoMap-like with .get('title'|'$label') or plain object
 * @returns {string|null}
 */
export function namekeyFromFactoryDefinitionContent(content) {
	if (!content || typeof content !== 'object') return null
	const get =
		typeof content.get === 'function'
			? (k) => content.get(k)
			: (k) => (k in content ? content[k] : undefined)
	const title = get('title')
	const label = get('$label')
	if (
		typeof title === 'string' &&
		(FACTORY_REF_PATTERN.test(title) || INSTANCE_REF_PATTERN.test(title))
	) {
		return title
	}
	if (
		typeof label === 'string' &&
		(FACTORY_REF_PATTERN.test(label) || INSTANCE_REF_PATTERN.test(label))
	) {
		return label
	}
	return null
}
