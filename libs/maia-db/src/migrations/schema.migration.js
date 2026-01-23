/**
 * Schema Migration - Identity Layer Only
 * 
 * IDEMPOTENT: Runs on account load, checks if migration already applied
 * 
 * Creates (if not exists):
 * 1. account.profile: Profile CoMap with name field (cojson requirement)
 * 2. account.universalGroup: Private Group (hardcoded owner/admin of ALL future CoValues)
 * 
 * ARCHITECTURE:
 * 
 * account.profile (CoMap - Profile)
 *   ├── name: <accountName> (string)
 *   ├── group: <universalGroupId> (co-id reference to universal group)
 *   └── headerMeta: {$schema: "ProfileSchema"}
 * 
 * account.universalGroup (Group - Private, Non-Public)
 *   └── Hardcoded owner/admin of ALL CoValues created by this account
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
	
	if (isCreation) {
		console.log("🔄 Running identity migration (account creation)...");
	} else {
		console.log("🔄 Running identity migration (idempotent, onload)...");
	}
	
	// 1. Check if universal group already exists (create first, needed for profile)
	let universalGroupId = account.get("universalGroup");
	let universalGroup;
	
	if (universalGroupId) {
		const loadedGroup = node.getCoValue(universalGroupId);
		if (loadedGroup && loadedGroup.type === "group") {
			const groupContent = node.getCoValue(universalGroupId)?.getCurrentContent?.();
			if (groupContent && typeof groupContent.createMap === 'function') {
				universalGroup = groupContent;
				console.log("   ℹ️  Universal group already exists:", universalGroupId);
			}
		}
	}
	
	if (!universalGroup) {
		// Create universal group (PRIVATE, non-public)
		// This group will be the hardcoded owner/admin of ALL future CoValues
		// Note: Groups are created via node.createGroup(), not account.createGroup()
		universalGroup = node.createGroup();
		account.set("universalGroup", universalGroup.id);
		console.log("   ✅ Universal group created:", universalGroup.id);
		console.log("      Group is PRIVATE (non-public)");
		console.log("      Group will be auto-assigned as owner/admin of all CoValues");
	}
	
	// 2. Check if profile already exists (cojson requirement)
	let profileId = account.get("profile");
	let profile;
	
	if (profileId) {
		const loadedProfile = node.getCoValue(profileId);
		if (loadedProfile && loadedProfile.type === "comap") {
			const profileContent = node.getCoValue(profileId)?.getCurrentContent?.();
			if (profileContent && typeof profileContent.get === 'function') {
				profile = profileContent;
				console.log("   ℹ️  Profile already exists:", profileId);
			}
		}
	}
	
	if (!profile) {
		// Create profile CoMap with name and group reference
		profile = account.createMap({
			name: accountName,
			group: universalGroup.id  // Reference to universal group for easy lookup
		}, {$schema: "ProfileSchema"});
		account.set("profile", profile.id);
		console.log("   ✅ Profile CoMap created:", profile.id);
		console.log("      Profile name:", accountName);
		console.log("      Profile group:", universalGroup.id);
	} else {
		// Update existing profile to include group reference if missing
		if (!profile.get("group")) {
			profile.set("group", universalGroup.id);
			console.log("   ✅ Updated existing profile with group reference:", universalGroup.id);
		}
	}
	
	console.log("🎉 Identity migration complete!");
	console.log("   Profile:", profile.id);
	console.log("   Universal Group:", universalGroup.id);
	
	// Final verification: Check if structures are linked to account
	const finalProfileId = account.get("profile");
	const finalUniversalGroupId = account.get("universalGroup");
	
	if (!finalProfileId) {
		console.warn("   ⚠️  account.profile not yet readable (transaction may not be processed yet)");
		console.warn("      Expected:", profile.id);
		console.warn("      This is OK - transaction will be processed by cojson");
	} else {
		console.log("   ✅ Verified: account.profile is linked:", finalProfileId);
	}
	
	if (!finalUniversalGroupId) {
		console.warn("   ⚠️  account.universalGroup not yet readable (transaction may not be processed yet)");
		console.warn("      Expected:", universalGroup.id);
		console.warn("      This is OK - transaction will be processed by cojson");
	} else {
		console.log("   ✅ Verified: account.universalGroup is linked:", finalUniversalGroupId);
	}
	
	console.log("   ✅ Migration complete - identity layer created");
	console.log("      Account structure:");
	console.log("        account.profile →", profile.id);
	console.log("        account.universalGroup →", universalGroup.id);
	console.log("      (All data structures will be created via seed() operation)");
}
