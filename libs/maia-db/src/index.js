/**
 * Main entry point for @MaiaOS/db
 * 
 * Pure cojson with custom schema migration
 */

import { createAccount } from "./services/oID.js";

/**
 * Create a new MaiaID (Account + Group + Profile)
 * 
 * Uses custom migration to set headerMeta on Profile
 * 
 * @param {Object} options - Account creation options
 * @param {string} options.name - Account name
 * @returns {Promise<{node, account, accountID, group, profile}>} LocalNode, Account, Group, and Profile
 */
export async function createMaiaID({ name = "MaiaID" } = {}) {
	// Create Account - custom migration creates Group + Profile with schemas
	const { node, account, accountID, group, profile } = await createAccount({ name });
	
	console.log("✅ MaiaID created:");
	console.log("   Account:", accountID);
	console.log("   Group:", group.id);
	console.log("   Profile:", profile.id);
	console.log("   Account headerMeta:", account.headerMeta);
	console.log("   Group headerMeta:", group.headerMeta);
	console.log("   Profile headerMeta:", profile.headerMeta);
	
	return {
		node,
		account,
		accountID,
		group,
		profile,
	};
}

// Re-export services for external use
export { createAccount } from "./services/oID.js";
export { createGroup } from "./services/oGroup.js";
export { createCoMap } from "./services/oMap.js";
export { createCoList } from "./services/oList.js";
export { createCoStream } from "./services/oStream.js";
export { createBinaryStream } from "./services/oBinary.js";
export { createPlainText } from "./services/oPlainText.js";
export { createProfile } from "./services/oProfile.js";
export { createSchemaMeta, hasSchema, getSchema } from "./utils/meta.js";
