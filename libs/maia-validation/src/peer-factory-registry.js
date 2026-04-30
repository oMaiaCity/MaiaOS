/**
 * Peer factory registry — bootstrap builtins + read metaschema from peer.
 */

export {
	createFactoryMeta,
	EXCEPTION_FACTORIES,
	FACTORY_REGISTRY,
	getFactory,
	hasFactory,
	isExceptionFactory,
	validateHeaderMetaFactory,
} from './data/builtin-factories.data.js'

export async function getMetaFactoryFromPeer(peer) {
	if (!peer) throw new Error('[getMetaFactoryFromPeer] Peer required')
	const metaSchemaCoId = peer?.infra?.meta
	if (!metaSchemaCoId) throw new Error('[getMetaFactoryFromPeer] Metaschema not found in registry')
	const metaSchemaStore = await peer.read(null, metaSchemaCoId)
	if (!metaSchemaStore || metaSchemaStore.value?.error) {
		throw new Error('[getMetaFactoryFromPeer] Failed to read metaschema from peer')
	}
	const metaSchemaCoMap = metaSchemaStore.value
	return metaSchemaCoMap.definition || metaSchemaCoMap
}
