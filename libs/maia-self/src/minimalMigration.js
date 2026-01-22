/**
 * Minimal Migration - Creates ONLY profile (required by Jazz)
 * 
 * Jazz requires account.profile to be set during initial migration.
 * This minimal migration creates the bare minimum: profile + its group.
 * 
 * All other example CoValues are created later by the seeding service,
 * which reuses this same group.
 */

// Import from maia-db (relative path since we're in maia-self)
import { createSchemaMeta } from "@MaiaOS/db";

/**
 * Minimal migration that creates profile (required by Jazz)
 * 
 * @param {RawAccount} account - The newly created account
 * @param {LocalNode} node - The LocalNode instance
 * @param {Object} creationProps - Creation properties
 * @param {string} creationProps.name - Account/profile name
 * @returns {Promise<void>}
 */
export async function minimalMigration(account, node, creationProps) {
	const { name } = creationProps;
	
	console.log("🔄 Running minimal migration (profile only)...");
	
	// Create group for profile (account-owned)
	const profileGroup = node.createGroup();
	profileGroup.addMember("everyone", "reader");
	
	console.log("   ✅ Profile group created:", profileGroup.id);
	
	// Create Profile CoMap with ProfileSchema
	const profileMeta = createSchemaMeta("ProfileSchema");
	const profile = profileGroup.createMap(
		{ name },
		profileMeta
	);
	
	console.log("   ✅ Profile created:", profile.id);
	console.log("      HeaderMeta:", profile.headerMeta);
	
	// Link profile to account (REQUIRED by Jazz!)
	account.set("profile", profile.id);
	
	console.log("   ✅ Profile linked to account");
}
