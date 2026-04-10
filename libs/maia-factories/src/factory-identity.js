/**
 * M4: Canonical factory logical refs — single map from disk path → °maia/factory/...
 * Hand-authored $id in *.factory.maia is removed; identity is derived here only.
 */

/** @type {Record<string, string>} */
export const FACTORY_PATH_TO_REF = {
	'meta.factory.maia': '°maia/factory/meta',
	'actor.factory.maia': '°maia/factory/actor',
	'aven-identity.factory.maia': '°maia/factory/os/aven-identity',
	'avens-identity-registry.factory.maia': '°maia/factory/os/avens-identity-registry',
	'capability.factory.maia': '°maia/factory/os/capability',
	'context.factory.maia': '°maia/factory/context',
	'cotext.factory.maia': '°maia/factory/os/cotext',
	'event.factory.maia': '°maia/factory/event',
	'factories-registry.factory.maia': '°maia/factory/os/factories-registry',
	'groups.factory.maia': '°maia/factory/os/groups',
	'human.factory.maia': '°maia/factory/os/human',
	'humans-registry.factory.maia': '°maia/factory/os/humans-registry',
	'inbox.factory.maia': '°maia/factory/inbox',
	'indexes-registry.factory.maia': '°maia/factory/os/indexes-registry',
	'maia-script-expression.factory.maia': '°maia/factory/maia-script-expression',
	'os-registry.factory.maia': '°maia/factory/os/os-registry',
	'process.factory.maia': '°maia/factory/process',
	'registries.factory.maia': '°maia/factory/os/registries',
	'sparks-registry.factory.maia': '°maia/factory/os/sparks-registry',
	'style.factory.maia': '°maia/factory/style',
	'vibe.factory.maia': '°maia/factory/vibe',
	'vibes-registry.factory.maia': '°maia/factory/os/vibes-registry',
	'view.factory.maia': '°maia/factory/view',
	'wasm.factory.maia': '°maia/factory/os/wasm',
	'chat.factory.maia': '°maia/factory/data/chat',
	'cobinary.factory.maia': '°maia/factory/data/cobinary',
	'notes.factory.maia': '°maia/factory/data/notes',
	'profile.factory.maia': '°maia/factory/data/profile',
	'spark.factory.maia': '°maia/factory/data/spark',
	'todos.factory.maia': '°maia/factory/data/todos',
}

/**
 * @param {object} raw - Parsed factory JSON (no authoritative $id)
 * @param {string} relativePath - Key in {@link FACTORY_PATH_TO_REF}
 */
export function withCanonicalFactorySchema(raw, relativePath) {
	if (!raw || typeof raw !== 'object') {
		throw new Error('[factory-identity] raw schema required')
	}
	const ref = FACTORY_PATH_TO_REF[relativePath]
	if (!ref) {
		throw new Error(`[factory-identity] Unknown factory file: ${relativePath}`)
	}
	return { ...raw, $id: ref }
}
