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
export { createGroup } from "./cojson/groups/coGroup.js";
export { createCoMap } from "./cojson/cotypes/coMap.js";
export { createCoList } from "./cojson/cotypes/coList.js";
export { createCoStream } from "./cojson/cotypes/coStream.js";
export { createProfile } from "./cojson/groups/coProfile.js";
export { createSchemaMeta, hasSchema, getSchema } from "./schemas/meta.js";
export { schemaMigration } from "./migrations/schema.migration.js";

// Subscription management (NEW)
export { 
	subscribe, 
	subscribeToLinked, 
	getSubscription, 
	hasSubscription, 
	unsubscribe,
	getSubscriptionStats 
} from "./cojson/subscriptions/coSubscription.js";

export { 
	SubscriptionCache,
	getGlobalCache,
	resetGlobalCache 
} from "./cojson/subscriptions/coSubscriptionCache.js";

// CoJSON Mini CRUD API (database-level wrapper)
export { createCoJSONAPI } from "./cojson/core/factory.js";

// CoJSON Backend (for MaiaOS.boot() compatibility)
export { CoJSONBackend } from "./cojson/core/cojson-backend.js";

// Process Inbox (backend-to-backend inbox processing)
export { processInbox } from "./cojson/crud/process-inbox.js";

// Message Helpers (create and push message CoMaps)
export { createAndPushMessage } from "./cojson/crud/message-helpers.js";

// Collection Helpers (schema index lookup)
export { getSchemaIndexColistId, getCoListId } from "./cojson/crud/collection-helpers.js";

// Universal Schema Resolver (single source of truth)
export { 
  resolveSchema,
  getSchemaCoId,
  loadSchemaDefinition,
  resolveHumanReadableKey,
  getSchemaCoIdFromCoValue,
  loadSchemaByCoId,
  checkCotype,
  loadSchemaFromDB,
  loadSchemasFromAccount
} from "./cojson/schema/resolver.js";
