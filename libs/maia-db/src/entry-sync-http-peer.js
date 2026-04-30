/**
 * Sync service: MaiaDB + capability/list helpers without importing the full `@MaiaOS/db` barrel.
 */
export { MaiaDB, SYSTEM_SPARK_REGISTRY_KEY } from './cojson/core/MaiaDB.js'
export {
	ensureCoValueAvailable,
	ensureCoValueLoaded,
	getCoListId,
	getFactoryIndexColistId,
} from './cojson/crud/collection-helpers.js'
export { findFirst } from './cojson/crud/read.js'
export { waitForStoreReady } from './cojson/crud/read-operations.js'
export {
	accountHasCapabilityOnPeer,
	getCapabilityGrantIndexColistCoIdFromPeer,
} from './cojson/helpers/capability-grants-resolve.js'
export {
	ensureIdentity,
	listAccountIdsFromIdentityIndex,
} from './cojson/registry/ensure-identity.js'
export { generateRegistryName } from './utils/registry-name-generator.js'
