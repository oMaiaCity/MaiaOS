/**
 * Schema Migration - Custom Account Initialization
 * 
 * Overrides cojson's default migration to create examples of all CoValue types
 * with their respective schemas in headerMeta.
 * 
 * Created CoValues:
 * - Group (no schema - cojson limitation)
 * - Profile (CoMap with ProfileSchema)
 * - ProfileList (CoList with ProfileListSchema)
 * - ActivityStream (CoStream with ActivityStreamSchema)
 * - AvatarStream (BinaryCoStream with AvatarStreamSchema)
 * - BioText (CoPlainText with BioTextSchema)
 */

import { createSchemaMeta } from "../utils/meta.js";

/**
 * Main schema migration for account initialization
 * 
 * This is the custom migration passed to LocalNode.withNewlyCreatedAccount()
 * 
 * @param {RawAccount} account - The newly created account
 * @param {LocalNode} node - The LocalNode instance
 * @param {Object} creationProps - Creation properties
 * @param {string} creationProps.name - Account/profile name
 * @returns {Promise<void>}
 */
export async function schemaMigration(account, node, creationProps) {
	const { name } = creationProps;
	
	console.log("🔄 Running schema migration for account:", name);
	
	// 1. Create profileGroup
	// Note: Groups don't support meta parameter in createGroup()
	// so we can't set headerMeta on Group creation
	const profileGroup = node.createGroup();
	profileGroup.addMember("everyone", "reader");
	
	console.log("   ✅ Group created:", profileGroup.id);
	console.log("      HeaderMeta:", profileGroup.headerMeta);
	
	// 2. Create Profile CoMap with headerMeta
	const profileMeta = createSchemaMeta("ProfileSchema");
	const profile = profileGroup.createMap(
		{ name },
		profileMeta  // Set headerMeta at creation time!
	);
	
	console.log("   ✅ Profile created:", profile.id);
	console.log("      Name:", name);
	console.log("      HeaderMeta:", profile.headerMeta);
	
	// 3. Create ProfileList with headerMeta (containing the profile as an item)
	const profileListMeta = createSchemaMeta("ProfileListSchema");
	const profileList = profileGroup.createList([profile.id], profileListMeta);
	
	console.log("   ✅ ProfileList created:", profileList.id);
	console.log("      HeaderMeta:", profileList.headerMeta);
	console.log("      Items:", profileList.toJSON());
	
	// 4. Create CoStream example (Activity/Message stream)
	const activityStreamMeta = createSchemaMeta("ActivityStreamSchema");
	const activityStream = profileGroup.createStream(activityStreamMeta);
	// Push initial activity
	activityStream.push({ type: "profile_created", name });
	activityStream.push({ type: "welcome", message: "Welcome to MaiaOS!" });
	activityStream.push({ type: "first_login", timestamp: new Date().toISOString() });
	
	console.log("   ✅ ActivityStream created:", activityStream.id);
	console.log("      HeaderMeta:", activityStream.headerMeta);
	console.log("      Items in stream:", activityStream.toJSON());
	
	// 5. Create BinaryCoStream example (Avatar/Image stream)
	const avatarStreamMeta = createSchemaMeta("AvatarStreamSchema");
	const avatarStream = profileGroup.createBinaryStream(avatarStreamMeta);
	// Push example binary data (simulating image chunks)
	// This is a tiny PNG file header as an example
	const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG signature
	const chunk1 = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]); // Example chunk 1
	const chunk2 = new Uint8Array([0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B]); // Example chunk 2
	
	avatarStream.push(pngHeader);
	avatarStream.push(chunk1);
	avatarStream.push(chunk2);
	
	console.log("   ✅ AvatarStream created:", avatarStream.id);
	console.log("      HeaderMeta:", avatarStream.headerMeta);
	console.log("      Binary chunks pushed:", 3, "Total bytes:", pngHeader.length + chunk1.length + chunk2.length);
	
	// 6. Create CoPlainText example (Bio/About text)
	const bioTextMeta = createSchemaMeta("BioTextSchema");
	const bioText = profileGroup.createPlainText(`Hi, I'm ${name}!`, bioTextMeta);
	
	console.log("   ✅ BioText created:", bioText.id);
	console.log("      HeaderMeta:", bioText.headerMeta);
	console.log("      Text:", bioText.toString());
	
	// 7. Link profile to account (required by cojson)
	account.set("profile", profile.id, "trusting");
	
	console.log("   ✅ Profile linked to account");
	console.log("🎉 Schema migration complete!");
}
