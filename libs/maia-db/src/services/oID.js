/**
 * oID Service - Account (Identity) primitive
 * 
 * Handles Account creation with custom schema migration
 */

import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { schemaMigration } from "../migrations/schema.migration.js";

/**
 * Create a new MaiaID (Account) with custom migration
 * 
 * Uses our custom schemaMigration to:
 * - Create Group (profileGroup)
 * - Create Profile with ProfileSchema in headerMeta
 * - Link profile to account
 * 
 * @param {Object} options
 * @param {string} options.name - Account name
 * @returns {Promise<{node, account, accountID, group, profile}>}
 */
export async function createAccount({ name = "MaiaID" } = {}) {
	const crypto = await WasmCrypto.create();
	
	console.log("🚀 Creating Account with custom migration...");
	
	// Create Account with custom migration
	const result = await LocalNode.withNewlyCreatedAccount({
		creationProps: { name },
		crypto,
		migration: schemaMigration,  // Use our custom migration!
	});
	
	const rawAccount = result.node.expectCurrentAccount("oID/createAccount");
	
	// Get the profile created by our migration
	const profileId = rawAccount.get("profile");
	if (!profileId) {
		throw new Error("Profile not created by schema migration");
	}
	
	const profileCoValue = result.node.getCoValue(profileId);
	if (!profileCoValue) {
		throw new Error("Profile CoValue not found");
	}
	const profile = profileCoValue.getCurrentContent();
	const group = profile.group;
	
	console.log("✅ Account created:");
	console.log("   Account ID:", rawAccount.id);
	console.log("   Account type:", rawAccount.type);
	console.log("   Account headerMeta:", rawAccount.headerMeta);
	console.log("   Profile ID:", profileId);
	console.log("   Profile headerMeta:", profile.headerMeta);
	console.log("   Group ID:", group.id);
	console.log("   Group headerMeta:", group.headerMeta);
	
	return {
		node: result.node,
		account: rawAccount,
		accountID: rawAccount.id,
		group: group,
		profile: profile,
	};
}
