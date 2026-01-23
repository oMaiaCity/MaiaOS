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
export { createAccountWithSecret, loadAccount } from "./services/oID.js";
export { createGroup } from "./services/oGroup.js";
export { createCoMap } from "./services/oMap.js";
export { createCoList } from "./services/oList.js";
export { createCoStream } from "./services/oStream.js";
export { createPlainText } from "./services/oPlainText.js";
export { createProfile } from "./services/oProfile.js";
export { createSchemaMeta, hasSchema, getSchema } from "./utils/meta.js";
export { schemaMigration } from "./migrations/schema.migration.js";

// Subscription management (NEW)
export { 
	subscribe, 
	subscribeToLinked, 
	getSubscription, 
	hasSubscription, 
	unsubscribe,
	getSubscriptionStats 
} from "./services/oSubscription.js";

export { 
	SubscriptionCache,
	getGlobalCache,
	resetGlobalCache 
} from "./services/oSubscriptionCache.js";

// CoJSON Mini CRUD API (database-level wrapper)
export { createCoJSONAPI } from "./cojson/factory.js";

// CoJSON Backend (for MaiaOS.boot() compatibility)
export { CoJSONBackend } from "./cojson/backend/cojson-backend.js";
