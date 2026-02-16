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

// Unified cache (subscriptions, stores, resolutions, resolved data)
export {
	CoCache,
	getGlobalCoCache,
	resetGlobalCoCache,
} from './cojson/cache/coCache.js'
// CoJSON Backend (for MaiaOS.boot() compatibility)
export { CoJSONBackend } from './cojson/core/cojson-backend.js'
// CoJSON Mini CRUD API (database-level wrapper)
export { createCoJSONAPI } from './cojson/core/factory.js'
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
// Process Inbox (backend-to-backend inbox processing)
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
export { waitForStoreReady } from './cojson/crud/read-operations.js'
// Re-export services for external use
// STRICT: No createAccount() - only createAccountWithSecret() and loadAccount()
export { createAccountWithSecret, loadAccount } from './cojson/groups/coID.js'
export { createGroup, createProfile } from './cojson/groups/create.js'
export { getSparkCapabilityGroupIdFromSparkCoId } from './cojson/groups/groups.js'
export { resolveAccountCoIdsToProfileNames } from './cojson/helpers/resolve-account-profile.js'
export { resolveGroupCoIdsToCapabilityNames } from './cojson/helpers/resolve-capability-group.js'
// Sync Peer Setup (client-side peer configuration for LocalNode)
export { setupSyncPeers, subscribeSyncState } from './cojson/peers/sync-peers.js'
// Universal Schema Resolver (single source of truth)
export {
	checkCotype,
	loadSchemasFromAccount,
	resolve,
	resolveReactive,
} from './cojson/schema/resolver.js'
export { simpleAccountSeed } from './cojson/schema/seed.js'
export { schemaMigration } from './migrations/schema.migration.js'
export {
	createSchemaMeta,
	EXCEPTION_SCHEMAS,
	getAllSchemas,
	getSchema,
	hasSchema,
} from './schemas/registry.js'
export { generateRegistryName } from './seed/registry-name-generator.js'
