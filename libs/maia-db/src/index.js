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

// Re-export services for external use
// STRICT: No createAccount() - only createAccountWithSecret() and loadAccount()
export { createAccountWithSecret, loadAccount } from "./cojson/groups/coID.js";
export { resolveAccountCoIdsToProfileNames } from "./cojson/helpers/resolve-account-profile.js";
export { resolveGroupCoIdsToCapabilityNames } from "./cojson/helpers/resolve-capability-group.js";
export { createGroup, createProfile } from "./cojson/groups/create.js";
export { createCoValueForSpark } from "./cojson/covalue/create-covalue-for-spark.js";
export { getSparkCapabilityGroupIdFromSparkCoId } from "./cojson/groups/groups.js";
export { createCoMap } from "./cojson/cotypes/coMap.js";
export { createCoList } from "./cojson/cotypes/coList.js";
export { createCoStream } from "./cojson/cotypes/coStream.js";
export { createSchemaMeta, hasSchema, getSchema, getAllSchemas, EXCEPTION_SCHEMAS } from "./schemas/registry.js";
export { seedAgentAccount } from "./cojson/schema/seed.js";
export { schemaMigration } from "./migrations/schema.migration.js";

// Unified cache (subscriptions, stores, resolutions, resolved data)
export { 
	CoCache,
	getGlobalCoCache,
	resetGlobalCoCache 
} from "./cojson/cache/coCache.js";

// CoJSON Mini CRUD API (database-level wrapper)
export { createCoJSONAPI } from "./cojson/core/factory.js";

// CoJSON Backend (for MaiaOS.boot() compatibility)
export { CoJSONBackend } from "./cojson/core/cojson-backend.js";

// Process Inbox (backend-to-backend inbox processing)
export { processInbox } from "./cojson/crud/process-inbox.js";

// Message Helpers (create and push message CoMaps)
export { createAndPushMessage } from "./cojson/crud/message-helpers.js";

// Collection Helpers (schema index lookup, CoValue loading)
export { getSchemaIndexColistId, getCoListId, ensureCoValueLoaded } from "./cojson/crud/collection-helpers.js";

// Read Operations (store-based loading with proper $store architecture)
export { waitForStoreReady } from "./cojson/crud/read-operations.js";

// Universal Schema Resolver (single source of truth)
export { 
  resolve,
  resolveReactive,
  checkCotype,
  loadSchemasFromAccount
} from "./cojson/schema/resolver.js";

// Reactive Dependency Resolver (universal progressive reactive resolution)
// Note: resolveReactive is exported from resolver.js (wraps reactive-resolver.js)
export {
  resolveSchemaReactive,
  resolveCoValueReactive,
  resolveQueryReactive,
  waitForReactiveResolution
} from "./cojson/crud/reactive-resolver.js";

// Sync Peer Setup (client-side peer configuration for LocalNode)
export { setupSyncPeers, subscribeSyncState } from "./cojson/peers/sync-peers.js";
