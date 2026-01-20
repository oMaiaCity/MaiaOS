/**
 * oSeeding Service - Example CoValues initialization
 * 
 * Creates example CoValues and links them to the account for Jazz lazy-loading:
 * - Profile CoMap (with ProfileSchema) - created during migration
 * - CoPlainText example
 * - CoStream example  
 * - Notes CoList (with NotesSchema)
 * - Examples CoMap (container linking all examples to account)
 * - PureJsonSchema CoMap (demonstrating all 7 JSON Schema types)
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
import { createCoList } from "./oList.js";
import { createPlainText } from "./oPlainText.js";
import { createCoStream } from "./oStream.js";
import { getSharedValidationEngine } from "../schemas/validation-singleton.js";
import { getAllSchemas } from "../schemas/registry.js";

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
 * @returns {Promise<Object>} Created CoValues (profileGroup, profile, plainText, stream, notes CoList, examplesMap)
 */
export async function seedExampleCoValues(node, account, { name = "Maia User" } = {}) {
	console.log("🌱 Starting seeding process...");
	
	// Get shared validation engine (already initialized and schemas registered)
	console.log("🔍 Getting shared validation engine...");
	const validationEngine = await getSharedValidationEngine();
	
	// Validate all schemas before seeding (double-check)
	console.log("🔍 Validating schemas before seeding...");
	const allSchemas = getAllSchemas();
	
	// PASS 1: Validate all schemas against meta-schema
	for (const [schemaName, schema] of Object.entries(allSchemas)) {
		const result = await validationEngine.validateSchema(schemaName, schema);
		if (!result.valid) {
			const errorDetails = result.errors
				.map(err => `  - ${err.instancePath}: ${err.message}`)
				.join('\n');
			console.error(`❌ Schema '${schemaName}' failed meta schema validation:\n${errorDetails}`);
			throw new Error(`Schema '${schemaName}' is not valid JSON Schema`);
		}
	}
	console.log("✅ All schemas validated against meta-schema");
	
	// Step 1: Get existing profile and its group (created during migration)
	console.log("📦 Step 1/6: Getting existing profile group...");
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
	console.log("📦 Step 2/6: Creating CoPlainText example...");
	const plainTextContent = "Hello from CoPlainText! This is an example of plain text storage in MaiaOS.";
	
	// Validate plain text data against TextSchema
	const textValidation = await validationEngine.validateData("TextSchema", plainTextContent);
	if (!textValidation.valid) {
		const errorDetails = textValidation.errors
			.map(err => `  - ${err.instancePath}: ${err.message}`)
			.join('\n');
		console.error(`❌ Plain text data failed validation:\n${errorDetails}`);
		throw new Error(`Plain text data is not valid against TextSchema`);
	}
	
	const plainText = await createPlainText(
		profileGroup,
		plainTextContent,
		"TextSchema"
	);
	console.log("   CoPlainText ID:", plainText.id);
	
	// ✅ CRITICAL: Wait for IndexedDB write to complete (offline-first pattern)
	if (node.storage) {
		await node.syncManager.waitForStorageSync(plainText.id);
		console.log("   💾 CoPlainText persisted to IndexedDB");
	}
	
	// Step 3: Create CoStream example (using profile's group)
	console.log("📦 Step 3/5: Creating CoStream example...");
	const stream = createCoStream(profileGroup, "ActivityStreamSchema");
	console.log("   CoStream ID:", stream.id);
	
	// ✅ CRITICAL: Wait for IndexedDB write to complete (offline-first pattern)
	if (node.storage) {
		await node.syncManager.waitForStorageSync(stream.id);
		console.log("   💾 CoStream persisted to IndexedDB");
	}
	
	// Step 4: Create Notes CoList (using profile's group)
	console.log("📦 Step 4/6: Creating Notes CoList...");
	const notesData = [
		{
			title: "My First Note",
			content: "This is an example note stored in a CoList. You can edit this later!",
			created: new Date().toISOString()
		}
	];
	
	// Validate notes data against NotesSchema
	const notesValidation = await validationEngine.validateData("NotesSchema", notesData);
	if (!notesValidation.valid) {
		const errorDetails = notesValidation.errors
			.map(err => `  - ${err.instancePath}: ${err.message}`)
			.join('\n');
		console.error(`❌ Notes data failed validation:\n${errorDetails}`);
		throw new Error(`Notes data is not valid against NotesSchema`);
	}
	
	const notes = await createCoList(
		profileGroup,
		notesData,
		"NotesSchema"
	);
	console.log("   Notes ID:", notes.id);
	
	// ✅ CRITICAL: Wait for IndexedDB write to complete (offline-first pattern)
	if (node.storage) {
		await node.syncManager.waitForStorageSync(notes.id);
		console.log("   💾 Notes persisted to IndexedDB");
	}
	
	// Step 5: Create PureJsonSchema CoMap (demonstrating all 7 JSON Schema types)
	console.log("📦 Step 5/6: Creating PureJsonSchema CoMap...");
	const pureJsonData = {
		string: "Hello, World!",
		number: 42.5,
		integer: 100,
		boolean: true,
		nullValue: null,
		object: {
			nested: "value",
			count: 5
		},
		array: [1, 2, 3, "four", true],
		author: profile.id // Co-id reference to Profile (demonstrates $ref)
	};
	
	// Validate PureJsonSchema data before creating
	const pureJsonValidation = await validationEngine.validateData("PureJsonSchema", pureJsonData);
	if (!pureJsonValidation.valid) {
		const errorDetails = pureJsonValidation.errors
			.map(err => `  - ${err.instancePath}: ${err.message}`)
			.join('\n');
		console.error(`❌ PureJsonSchema data failed validation:\n${errorDetails}`);
		throw new Error(`PureJsonSchema data is not valid`);
	}
	
	const pureJsonMap = await createCoMap(
		profileGroup,
		pureJsonData,
		"PureJsonSchema"
	);
	console.log("   PureJsonSchema CoMap ID:", pureJsonMap.id);
	
	// ✅ CRITICAL: Wait for IndexedDB write to complete
	if (node.storage) {
		await node.syncManager.waitForStorageSync(pureJsonMap.id);
		console.log("   💾 PureJsonSchema persisted to IndexedDB");
	}
	
	// Step 6: Create Examples CoMap and link to account (CRITICAL for Jazz lazy-loading!)
	console.log("📦 Step 6/6: Creating Examples CoMap and linking to account...");
	const examplesData = {
		plainText: plainText.id,
		stream: stream.id,
		notes: notes.id,
		pureJson: pureJsonMap.id
	};
	
	// Validate examples data against ExamplesSchema
	const examplesValidation = await validationEngine.validateData("ExamplesSchema", examplesData);
	if (!examplesValidation.valid) {
		const errorDetails = examplesValidation.errors
			.map(err => `  - ${err.instancePath}: ${err.message}`)
			.join('\n');
		console.error(`❌ Examples data failed validation:\n${errorDetails}`);
		throw new Error(`Examples data is not valid against ExamplesSchema`);
	}
	
	const examplesMap = await createCoMap(
		profileGroup,
		examplesData,
		"ExamplesSchema" // Schema for examples container
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
	console.log("   Total CoValues created: 6 (profile already exists, + plainText, stream, notes CoList, pureJsonMap, examplesMap)");
	console.log("   All examples owned by profile's group:", profileGroup.id);
	console.log("   All examples linked via account.examples for automatic loading!");
	console.log("   💾 All CoValues persisted to IndexedDB (offline-first!)");
	
	return {
		profileGroup,  // The reused group
		profile,       // Already exists (from migration)
		plainText,
		stream,
		notes,
		pureJsonMap,   // PureJsonSchema CoMap
		examplesMap,   // Container linking examples to account
	};
}
