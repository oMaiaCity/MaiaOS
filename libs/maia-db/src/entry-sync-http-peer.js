/**
 * Sync service: MaiaDB + capability/list helpers without importing the full `@MaiaOS/db` barrel.
 */
export {
	accountHasCapabilityOnPeer,
	ensureCoValueAvailable,
	ensureCoValueLoaded,
	ensureIdentity,
	findFirst,
	getCapabilityGrantIndexColistCoIdFromPeer,
	getCoListId,
	getFactoryIndexColistId,
	listAccountIdsFromIdentityIndex,
	MaiaDB,
	SYSTEM_SPARK_REGISTRY_KEY,
	waitForStoreReady,
} from './modules/cojson-impl.js'
export { generateRegistryName } from './utils/registry-name-generator.js'
