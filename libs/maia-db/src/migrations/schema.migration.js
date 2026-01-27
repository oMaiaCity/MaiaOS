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
 * account.profile (CoMap - Profile)
 *   ├── name: <accountName> (string)
 *   ├── group: <universalGroupId> (co-id reference to universal group - used as owner/admin of ALL CoValues)
 *   └── headerMeta: {$schema: "ProfileSchema"}
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
 * @param {string} [creationProps.name] - Account/profile name (optional)
 * @returns {Promise<void>}
 */
export async function schemaMigration(account, node, creationProps) {
	const isCreation = creationProps !== undefined;
	const accountName = creationProps?.name || "maia";
	
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
				console.log("   ℹ️  Profile already exists:", profileId);
				
				// Check if profile has group reference
				const existingGroupId = profile.get("group");
				if (existingGroupId) {
					const loadedGroup = node.getCoValue(existingGroupId);
					if (loadedGroup && loadedGroup.type === "group") {
						const groupContent = loadedGroup.getCurrentContent?.();
						if (groupContent && typeof groupContent.createMap === 'function') {
							universalGroup = groupContent;
							console.log("   ℹ️  Universal group already exists (from profile):", existingGroupId);
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
		// Create profile CoMap with name and group reference
		profile = account.createMap({
			name: accountName,
			group: universalGroup.id  // Reference to universal group (single source of truth)
		}, {$schema: "ProfileSchema"});
		account.set("profile", profile.id);
	} else {
		// Update existing profile to include group reference if missing
		if (!profile.get("group")) {
			profile.set("group", universalGroup.id);
		}
	}
	
	// Identity migration complete
}
