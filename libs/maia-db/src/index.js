/**
 * Main entry point for @MaiaOS/db
 *
 * Pure cojson with custom schema migration and automatic subscription management
 * STRICT: All account operations require passkey-derived agentSecret
 *
 * NEW: Subscription Layer
 * - Automatic CoValue loading from IndexedDB
 * - Subscription caching and deduplication
 * - Auto-loading of linked CoValues
 * - Memory-efficient cleanup
 */

// Sync Peer Setup (client-side peer configuration for LocalNode) - re-exported from @MaiaOS/peer
export { setupSyncPeers, subscribeSyncState } from '@MaiaOS/peer'
// Unified cache (subscriptions, stores, resolutions, resolved data)
export {
	CoCache,
	getGlobalCoCache,
	resetGlobalCoCache,
} from './cojson/cache/coCache.js'
// CoJSON Mini CRUD API (database-level wrapper)
export { createCoJSONAPI } from './cojson/core/factory.js'
// MaiaDB - single data layer implementation (was CoJSONBackend)
export { MaiaDB } from './cojson/core/MaiaDB.js'
export { createCoList } from './cojson/cotypes/coList.js'
export { createCoMap } from './cojson/cotypes/coMap.js'
export { createCoStream } from './cojson/cotypes/coStream.js'
export { createCoValueForSpark } from './cojson/covalue/create-covalue-for-spark.js'
// Collection Helpers (schema index lookup, CoValue loading)
export {
	ensureCoValueLoaded,
	getCoListId,
	getSchemaIndexColistId,
} from './cojson/crud/collection-helpers.js'
// Message Helpers (create and push message CoMaps)
export { createAndPushMessage } from './cojson/crud/message-helpers.js'
// Process Inbox (peer-to-peer inbox processing)
export { processInbox } from './cojson/crud/process-inbox.js'
// Reactive Dependency Resolver (universal progressive reactive resolution)
// Note: resolveReactive is exported from resolver.js (wraps reactive-resolver.js)
export {
	resolveCoValueReactive,
	resolveQueryReactive,
	resolveSchemaReactive,
	waitForReactiveResolution,
} from './cojson/crud/reactive-resolver.js'
// Read Operations (store-based loading with proper $store architecture)
export { findFirst } from './cojson/crud/read.js'
export { waitForStoreReady } from './cojson/crud/read-operations.js'
// Re-export services for external use
// STRICT: No createAccount() - only createAccountWithSecret() and loadAccount()
export { createAccountWithSecret, loadAccount } from './cojson/groups/coID.js'
export { createGroup, createProfile } from './cojson/groups/create.js'
export {
	getSparkCapabilityGroupIdFromSparkCoId,
	removeGroupMember,
} from './cojson/groups/groups.js'
export {
	resolveAccountCoIdsToProfileNames,
	resolveAccountToProfileCoId,
} from './cojson/helpers/resolve-account-profile.js'
export { resolveGroupCoIdsToCapabilityNames } from './cojson/helpers/resolve-capability-group.js'
// Universal Schema Resolver (single source of truth)
export {
	checkCotype,
	loadSchemasFromAccount,
	resolve,
	resolveReactive,
} from './cojson/schema/resolver.js'
export { schemaMigration } from './migrations/schema.migration.js'
export { simpleAccountSeed } from './migrations/seeding/seed.js'
// ReactiveStore - reactive data store pattern (owned by maia-db; engines import from here)
export { ReactiveStore } from './reactive-store.js'
export {
	createSchemaMeta,
	EXCEPTION_SCHEMAS,
	getAllSchemas,
	getSchema,
	hasSchema,
} from './schemas/registry.js'
export { generateRegistryName } from './utils/registry-name-generator.js'
