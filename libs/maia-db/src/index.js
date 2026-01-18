/**
 * Main entry point for @MaiaOS/db
 * 
 * Pure cojson with custom schema migration
 * STRICT: All account operations require passkey-derived agentSecret
 */

// Re-export services for external use
// STRICT: No createAccount() - only createAccountWithSecret() and loadAccount()
export { createAccountWithSecret, loadAccount } from "./services/oID.js";
export { createGroup } from "./services/oGroup.js";
export { createCoMap } from "./services/oMap.js";
export { createCoList } from "./services/oList.js";
export { createCoStream } from "./services/oStream.js";
export { createBinaryStream } from "./services/oBinary.js";
export { createPlainText } from "./services/oPlainText.js";
export { createProfile } from "./services/oProfile.js";
export { createSchemaMeta, hasSchema, getSchema } from "./utils/meta.js";
