/**
 * Schema Migration - Identity Layer Only
 * 
 * IDEMPOTENT: Runs on account load, checks if migration already applied
 * 
 * Creates (if not exists):
 * 1. account.profile: Profile CoMap with name and group reference
 * 
 * ARCHITECTURE:
 * 
 * NAMING CONVENTION:
 * - Profile name = "passkey" (represents EOA/Externally Owned Account - passkey-based authentication identity)
 * 
 * CONCEPTUAL MODEL:
 * - Accounts/Profiles = EOAs (like Ethereum EOAs) - just authentication primitives, don't own co-values
 * - Groups = Smart Contract Accounts (like Gnosis Safes) - own all co-values, enable flexible access control
 * - Only groups own co-values (for flexible access control in the future)
 * 
 * account.profile (CoMap - Profile)
 *   ├── name: "passkey" (string) - EOA identity name
 *   ├── group: <universalGroupId> (co-id reference to universal group - used as owner/admin of ALL CoValues)
 *   └── headerMeta: {$schema: "ProfileSchema"}
 * 
 * universalGroup (Group CoMap)
 *   └── (no additional properties set - group is identified by its co-id)
 * 
 * The universal group is stored ONLY in account.profile.group (single source of truth)
 * 
 * IDENTITY LAYER ONLY:
 * - This migration creates ONLY identity structures (who you are)
 * - All data structures (os, schematas, schemas, data) are created via seed() operation
 * - Universal group is automatically assigned as owner/admin on all CoValue creation
 * 
 * This migration runs on LocalNode.withLoadedAccount() - runs every time account loads
 * 
 * @param {RawAccount} account - The account (new or existing)
 * @param {LocalNode} node - The LocalNode instance
 * @param {Object} [creationProps] - Creation properties (optional, only for new accounts)
 * @param {string} [creationProps.name] - Account name (optional, legacy - not used for profile/group names)
 * @returns {Promise<void>}
 */
export async function schemaMigration(account, node, creationProps) {
	const isCreation = creationProps !== undefined;
	
	// NAMING CONVENTION:
	// Profile name = "passkey" (represents EOA/passkey identity)
	const PROFILE_NAME = "passkey";
	
	// Running identity migration
	
	// 1. Check if profile already exists (cojson requirement)
	let profileId = account.get("profile");
	let profile;
	let universalGroup;
	
	if (profileId) {
		const loadedProfile = node.getCoValue(profileId);
		if (loadedProfile && loadedProfile.type === "comap") {
			const profileContent = node.getCoValue(profileId)?.getCurrentContent?.();
			if (profileContent && typeof profileContent.get === 'function') {
				profile = profileContent;
				
				// Check if profile has group reference
				const existingGroupId = profile.get("group");
				if (existingGroupId) {
					const loadedGroup = node.getCoValue(existingGroupId);
					if (loadedGroup && loadedGroup.type === "group") {
						const groupContent = loadedGroup.getCurrentContent?.();
						if (groupContent && typeof groupContent.createMap === 'function') {
							universalGroup = groupContent;
						}
					}
				}
			}
		}
	}
	
	// 2. Create universal group if needed (create first, needed for profile)
	if (!universalGroup) {
		// Create universal group (PRIVATE, non-public)
		// This group will be the hardcoded owner/admin of ALL future CoValues
		// Note: Groups are created via node.createGroup(), not account.createGroup()
		universalGroup = node.createGroup();
	}
	
	// 3. Create or update profile with group reference
	if (!profile) {
		// Create profile CoMap with name "passkey" and group reference
		profile = account.createMap({
			name: PROFILE_NAME,  // Hardcoded: "passkey" (represents EOA identity)
			group: universalGroup.id  // Reference to universal group (single source of truth)
		}, {$schema: "ProfileSchema"});
		account.set("profile", profile.id);
	} else {
		// Update existing profile to include group reference if missing
		if (!profile.get("group")) {
			profile.set("group", universalGroup.id);
		}
		// Migration: Update existing profile name if it doesn't match "passkey"
		const currentProfileName = profile.get("name");
		if (currentProfileName !== PROFILE_NAME) {
			profile.set("name", PROFILE_NAME);
			console.log(`   🔄 Updated profile name from "${currentProfileName}" to "${PROFILE_NAME}"`);
		}
	}
	
	// Identity migration complete
}
