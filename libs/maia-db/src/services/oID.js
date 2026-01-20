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
 * Note: Migration now runs on load (via loadAccount), not during creation.
 * This ensures consistent migration behavior for both new and existing accounts.
 * 
 * @param {Object} options
 * @param {Object} options.agentSecret - AgentSecret from passkey (REQUIRED)
 * @param {string} options.name - Account name (default: "Maia")
 * @returns {Promise<{node, account, accountID, profile, group}>}
 */
export async function createAccountWithSecret({ agentSecret, name = "Maia" }) {
	if (!agentSecret) {
		throw new Error("agentSecret is required. Use signInWithPasskey() to get agentSecret.");
	}

	const crypto = await WasmCrypto.create();
	
	console.log("🚀 Creating Account with passkey-derived secret...");
	
	// Create Account with schemaMigration
	// schemaMigration handles profile during creation and schemata/Data on load
	const result = await LocalNode.withNewlyCreatedAccount({
		creationProps: { name },
		crypto,
		initialAgentSecret: agentSecret,  // Use provided secret from passkey!
		migration: schemaMigration,  // Handles profile + schemata + Data
	});
	
	const rawAccount = result.node.expectCurrentAccount("oID/createAccountWithSecret");
	
	// Get the profile value
	const profileValue = rawAccount.get("profile");
	if (!profileValue) {
		throw new Error("Profile not created by account creation migration");
	}
	
	console.log("✅ Account created with passkey:");
	console.log("   Account ID:", rawAccount.id);
	console.log("   Account type:", rawAccount.type);
	console.log("   Profile value:", profileValue);
	console.log("   ℹ️  Full migration will run on first load");
	
	return {
		node: result.node,
		account: rawAccount,
		accountID: rawAccount.id,
		profile: profileValue,
		group: null,  // No group in minimal setup
	};
}

/**
 * Load an existing MaiaID (Account) with provided agentSecret
 * STRICT: Requires agentSecret from passkey authentication
 * 
 * Runs schemaMigration on load (idempotent - checks if migration already applied)
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
	
	// Load existing account with migration hook
	const node = await LocalNode.withLoadedAccount({
		crypto,
		accountID,
		accountSecret: agentSecret,
		sessionID: crypto.newRandomSessionID(accountID),
		peers: [],  // TODO: Add sync server peer
		migration: schemaMigration,  // ← Runs on every load, idempotent
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
