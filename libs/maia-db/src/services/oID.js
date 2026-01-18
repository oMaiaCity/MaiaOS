/**
 * oID Service - Account (Identity) primitive
 * 
 * STRICT: Uses passkey-derived agentSecret, no random generation
 */

import { LocalNode } from "cojson";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { schemaMigration } from "../migrations/schema.migration.js";

/**
 * Create a new MaiaID (Account) with provided agentSecret
 * STRICT: Requires agentSecret from passkey authentication
 * 
 * Uses our custom schemaMigration to:
 * - Create Group (profileGroup)
 * - Create Profile with ProfileSchema in headerMeta
 * - Link profile to account
 * 
 * @param {Object} options
 * @param {Object} options.agentSecret - AgentSecret from passkey (REQUIRED)
 * @param {string} options.name - Account name (default: "Maia")
 * @returns {Promise<{node, account, accountID, group, profile}>}
 */
export async function createAccountWithSecret({ agentSecret, name = "Maia" }) {
	if (!agentSecret) {
		throw new Error("agentSecret is required. Use signInWithPasskey() to get agentSecret.");
	}

	const crypto = await WasmCrypto.create();
	
	console.log("🚀 Creating Account with passkey-derived secret...");
	
	// Create Account with provided agentSecret and custom migration
	const result = await LocalNode.withNewlyCreatedAccount({
		creationProps: { name },
		crypto,
		initialAgentSecret: agentSecret,  // Use provided secret from passkey!
		migration: schemaMigration,
	});
	
	const rawAccount = result.node.expectCurrentAccount("oID/createAccountWithSecret");
	
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
	
	console.log("✅ Account created with passkey:");
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

/**
 * Load an existing MaiaID (Account) with provided agentSecret
 * STRICT: Requires agentSecret from passkey authentication
 * 
 * @param {Object} options
 * @param {string} options.accountID - Account ID to load
 * @param {Object} options.agentSecret - AgentSecret from passkey (REQUIRED)
 * @returns {Promise<{node, account, accountID}>}
 */
export async function loadAccount({ accountID, agentSecret }) {
	if (!agentSecret) {
		throw new Error("agentSecret is required. Use signInWithPasskey() to get agentSecret.");
	}
	if (!accountID) {
		throw new Error("accountID is required.");
	}

	const crypto = await WasmCrypto.create();
	
	console.log("🔑 Loading existing account with passkey...");
	console.log("   Account ID:", accountID);
	
	// Load existing account
	const node = await LocalNode.withLoadedAccount({
		crypto,
		accountID,
		accountSecret: agentSecret,
		sessionID: crypto.newRandomSessionID(accountID),
		peers: [],  // TODO: Add sync server peer
	});
	
	const rawAccount = node.expectCurrentAccount("oID/loadAccount");
	
	console.log("✅ Account loaded:");
	console.log("   Account ID:", rawAccount.id);
	console.log("   Account type:", rawAccount.type);
	
	return {
		node,
		account: rawAccount,
		accountID: rawAccount.id,
	};
}
