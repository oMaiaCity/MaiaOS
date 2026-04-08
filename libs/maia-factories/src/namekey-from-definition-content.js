/**
 * Single source for catalog namekey extraction (definition CoMap content: title / $id).
 * Used by spark.os registry build and tests — keep in sync with factory ref patterns.
 */

import { FACTORY_REF_PATTERN, INSTANCE_REF_PATTERN } from './patterns.js'

/**
 * @param {object|null|undefined} content - CoMap-like with .get('title'|'$id') or plain { title, $id }
 * @returns {string|null}
 */
export function namekeyFromFactoryDefinitionContent(content) {
	if (!content || typeof content !== 'object') return null
	const get =
		typeof content.get === 'function'
			? (k) => content.get(k)
			: (k) => (k in content ? content[k] : undefined)
	const title = get('title')
	const idKey = get('$id')
	if (
		typeof title === 'string' &&
		(FACTORY_REF_PATTERN.test(title) || INSTANCE_REF_PATTERN.test(title))
	) {
		return title
	}
	if (
		typeof idKey === 'string' &&
		(FACTORY_REF_PATTERN.test(idKey) || INSTANCE_REF_PATTERN.test(idKey))
	) {
		return idKey
	}
	return null
}
