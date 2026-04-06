/**
 * M4: Canonical factory logical refs — single map from disk path → °maia/factory/...
 * Hand-authored $id in *.factory.json is removed; identity is derived here only.
 */

/** @type {Record<string, string>} */
export const FACTORY_PATH_TO_REF = {
	'os/meta.factory.json': '°maia/factory/meta',
	'os/actor.factory.json': '°maia/factory/actor',
	'os/aven-identity.factory.json': '°maia/factory/os/aven-identity',
	'os/avens-identity-registry.factory.json': '°maia/factory/os/avens-identity-registry',
	'os/capabilities-stream.factory.json': '°maia/factory/os/capabilities-stream',
	'os/capability.factory.json': '°maia/factory/os/capability',
	'os/context.factory.json': '°maia/factory/context',
	'os/cotext.factory.json': '°maia/factory/os/cotext',
	'os/event.factory.json': '°maia/factory/event',
	'os/factories-registry.factory.json': '°maia/factory/os/factories-registry',
	'os/groups.factory.json': '°maia/factory/os/groups',
	'os/human.factory.json': '°maia/factory/os/human',
	'os/humans-registry.factory.json': '°maia/factory/os/humans-registry',
	'os/inbox.factory.json': '°maia/factory/inbox',
	'os/indexes-registry.factory.json': '°maia/factory/os/indexes-registry',
	'os/maia-script-expression.factory.json': '°maia/factory/maia-script-expression',
	'os/os-registry.factory.json': '°maia/factory/os/os-registry',
	'os/process.factory.json': '°maia/factory/process',
	'os/registries.factory.json': '°maia/factory/os/registries',
	'os/sparks-registry.factory.json': '°maia/factory/os/sparks-registry',
	'os/style.factory.json': '°maia/factory/style',
	'os/vibe.factory.json': '°maia/factory/vibe',
	'os/vibes-registry.factory.json': '°maia/factory/os/vibes-registry',
	'os/view.factory.json': '°maia/factory/view',
	'os/wasm.factory.json': '°maia/factory/os/wasm',
	'data/chat.factory.json': '°maia/factory/data/chat',
	'data/cobinary.factory.json': '°maia/factory/data/cobinary',
	'data/notes.factory.json': '°maia/factory/data/notes',
	'data/profile.factory.json': '°maia/factory/data/profile',
	'data/spark.factory.json': '°maia/factory/data/spark',
	'data/todos.factory.json': '°maia/factory/data/todos',
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
