/**
 * oSeeding Service - Example CoValues initialization
 * 
 * Creates example CoValues and links them to the account for Jazz lazy-loading:
 * - Profile CoMap (with ProfileSchema) - created during migration
 * - CoPlainText example
 * - CoStream example  
 * - Notes CoMap (with NotesSchema)
 * - Examples CoMap (container linking all examples to account)
 * 
 * CRITICAL: Must call waitForStorageSync() after creating each CoValue!
 * This ensures CoValues are persisted to IndexedDB before the function returns.
 * Without this, rapid sign-out can occur before the async write queue flushes,
 * causing CoValues to be lost.
 * 
 * Pattern (from LocalNode.withNewlyCreatedAccount):
 * 1. Create CoValue
 * 2. await node.syncManager.waitForStorageSync(coValueId) 
 * 3. CoValue is now safely in IndexedDB
 * 
 * This service provides a clean separation between account creation (authentication)
 * and example data seeding (initialization).
 */

import { createCoMap } from "./oMap.js";
import { createPlainText } from "./oPlainText.js";
import { createCoStream } from "./oStream.js";

/**
 * Seed example CoValues for a new account
 * 
 * REUSES the existing profile's group (created during migration) for all example CoValues.
 * This ensures we don't create duplicate groups and keeps the account structure clean.
 * 
 * LINKS all examples to account via "examples" property. This is CRITICAL for Jazz's
 * lazy-loading system. Without this link, seeded CoValues are orphaned in IndexedDB
 * and won't be loaded on sign-in.
 * 
 * @param {LocalNode} node - The LocalNode instance
 * @param {RawAccount} account - The account to seed data for
 * @param {Object} options - Configuration options
 * @param {string} options.name - User's display name (default: "Maia User")
 * @returns {Promise<Object>} Created CoValues (profileGroup, profile, plainText, stream, notes, examplesMap, subscriptions)
 */
export async function seedExampleCoValues(node, account, { name = "Maia User" } = {}) {
	console.log("🌱 Starting seeding process...");
	
	// Step 1: Get existing profile and its group (created during migration)
	console.log("📦 Step 1/5: Getting existing profile group...");
	const profileId = account.get("profile");
	if (!profileId) {
		throw new Error("Profile not found! Migration must create profile first.");
	}
	
	const profileCoValue = node.getCoValue(profileId);
	if (!profileCoValue) {
		throw new Error(`Profile CoValue not found: ${profileId}`);
	}
	
	const profile = profileCoValue.getCurrentContent();
	const profileGroup = profile.group; // REUSE existing group!
	
	console.log("   Profile ID:", profile.id);
	console.log("   Profile Group ID:", profileGroup.id);
	console.log("   ✅ Reusing existing profile group for all examples");
	
	// Step 2: Create CoPlainText example (using profile's group)
	console.log("📦 Step 2/5: Creating CoPlainText example...");
	const plainText = createPlainText(
		profileGroup,
		"Hello from CoPlainText! This is an example of plain text storage in MaiaOS.",
		null
	);
	console.log("   CoPlainText ID:", plainText.id);
	
	// ✅ CRITICAL: Wait for IndexedDB write to complete (offline-first pattern)
	if (node.storage) {
		await node.syncManager.waitForStorageSync(plainText.id);
		console.log("   💾 CoPlainText persisted to IndexedDB");
	}
	
	// Step 3: Create CoStream example (using profile's group)
	console.log("📦 Step 3/5: Creating CoStream example...");
	const stream = createCoStream(profileGroup, "ActivityStream");
	console.log("   CoStream ID:", stream.id);
	
	// ✅ CRITICAL: Wait for IndexedDB write to complete (offline-first pattern)
	if (node.storage) {
		await node.syncManager.waitForStorageSync(stream.id);
		console.log("   💾 CoStream persisted to IndexedDB");
	}
	
	// Step 4: Create Notes CoMap (using profile's group)
	console.log("📦 Step 4/5: Creating Notes CoMap...");
	const notes = createCoMap(
		profileGroup,
		{
			title: "My First Note",
			content: "This is an example note stored in a CoMap. You can edit this later!",
			created: new Date().toISOString()
		},
		"NotesSchema"
	);
	console.log("   Notes ID:", notes.id);
	
	// ✅ CRITICAL: Wait for IndexedDB write to complete (offline-first pattern)
	if (node.storage) {
		await node.syncManager.waitForStorageSync(notes.id);
		console.log("   💾 Notes persisted to IndexedDB");
	}
	
	// Step 5: Create Examples CoMap and link to account (CRITICAL for Jazz lazy-loading!)
	console.log("📦 Step 5/5: Creating Examples CoMap and linking to account...");
	const examplesMap = createCoMap(
		profileGroup,
		{
			plainText: plainText.id,
			stream: stream.id,
			notes: notes.id,
		},
		null // No schema needed for examples container
	);
	console.log("   Examples CoMap ID:", examplesMap.id);
	
	// ✅ CRITICAL: Wait for IndexedDB write to complete (offline-first pattern)
	if (node.storage) {
		await node.syncManager.waitForStorageSync(examplesMap.id);
		console.log("   💾 Examples CoMap persisted to IndexedDB");
	}
	
	// Link examples to account - this ensures Jazz loads them on sign-in!
	// Without this link, seeded CoValues are orphaned and won't be loaded from IndexedDB
	account.set("examples", examplesMap.id);
	console.log("   ✅ Examples linked to account.examples");
	
	// ✅ CRITICAL: Wait for account modification to persist (offline-first pattern)
	if (node.storage) {
		await node.syncManager.waitForStorageSync(account.id);
		console.log("   💾 Account modifications persisted to IndexedDB");
	}
	
	console.log("✅ Seeding process complete!");
	console.log("   Total CoValues created: 5 (profile already exists, + plainText, stream, notes, examplesMap)");
	console.log("   All examples owned by profile's group:", profileGroup.id);
	console.log("   All examples linked via account.examples for automatic loading!");
	console.log("   💾 All CoValues persisted to IndexedDB (offline-first!)");
	
	return {
		profileGroup,  // The reused group
		profile,       // Already exists (from migration)
		plainText,
		stream,
		notes,
		examplesMap,   // Container linking examples to account
	};
}
