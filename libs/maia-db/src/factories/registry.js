/**
 * Schema Registry — peer-backed metaschema + re-exports of bootstrap builtins from @MaiaOS/factories.
 */

import { getRuntimeRef, RUNTIME_REF } from '../cojson/factory/runtime-factory-refs.js'

export {
	createFactoryMeta,
	EXCEPTION_FACTORIES,
	FACTORY_REGISTRY,
	getSchema,
	hasSchema,
	isExceptionFactory,
	validateHeaderMetaFactory,
} from '@MaiaOS/factories/builtin-schemas'

export async function getMetaFactoryFromPeer(peer) {
	if (!peer) throw new Error('[getMetaFactoryFromPeer] Peer required')
	const metaSchemaCoId = getRuntimeRef(peer, RUNTIME_REF.META)
	if (!metaSchemaCoId) throw new Error('[getMetaFactoryFromPeer] Metaschema not found in registry')
	const metaSchemaStore = await peer.read(null, metaSchemaCoId)
	if (!metaSchemaStore || metaSchemaStore.value?.error) {
		throw new Error('[getMetaFactoryFromPeer] Failed to read metaschema from peer')
	}
	const metaSchemaCoMap = metaSchemaStore.value
	return metaSchemaCoMap.definition || metaSchemaCoMap
}

export { loadFactoriesFromAccount } from '../cojson/factory/resolver.js'
