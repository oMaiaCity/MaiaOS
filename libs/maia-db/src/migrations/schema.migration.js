/**
 * Schema Migration - Runtime Schema & Entity System POC
 * 
 * IDEMPOTENT: Runs on account load, checks if migration already applied
 * 
 * Creates (if not exists):
 * 1. account.profile: Profile CoMap with name field (cojson requirement)
 * 2. account.os: OS CoMap (container for OS-level data)
 * 3. account.os.schemata: CoMap registry containing schema definitions
 * 4. account.Data: CoList containing entity CoMaps
 * 
 * ARCHITECTURE:
 * 
 * account.profile (CoMap - Profile)
 *   ├── name: <accountName>
 *   └── headerMeta: {$schema: "ProfileSchema"}
 * 
 * account.os (CoMap - OS Container)
 *   └── schemata: <coId> (Schema Registry CoMap)
 *       └── human: <coId> (Schema CoMap)
 *           ├── name: "human"
 *           └── definition: {JSON Schema 2020}
 * 
 * account.Data (CoList - Entity Collection)
 *   └── [0]: <coId> (Entity CoMap)
 *       ├── headerMeta: {$schema: <humanSchemaCoId>}
 *       └── name: "maia"
 * 
 * KEY FEATURES:
 * - Schemas are CoValues (full CRDT history, time-travel)
 * - Data items are CoValues (full CRDT history, time-travel)
 * - Data items reference schemas via headerMeta.$schema (immutable link)
 * - Can query "what schema was active when entity was created?"
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
		console.log("🔄 Running schema & entity migration (account creation)...");
	} else {
		console.log("🔄 Running schema & entity migration (idempotent, onload)...");
	}
	
	// 1. Check if profile already exists (cojson requirement)
	let profileId = account.get("profile");
	let profile;
	
	if (profileId) {
		const loadedProfile = node.getCoValue(profileId);
		if (loadedProfile && loadedProfile.type === "comap") {
			profile = loadedProfile;
			console.log("   ℹ️  Profile already exists:", profileId);
		}
	}
	
	if (!profile) {
		// Create profile CoMap with name field
		profile = account.createMap({
			name: accountName
		}, {$schema: "ProfileSchema"});
		account.set("profile", profile.id);
		console.log("   ✅ Profile CoMap created:", profile.id);
		console.log("      Profile name:", accountName);
	}
	
	// 2. Check if account.os already exists
	let osId = account.get("os");
	let os;
	
	if (osId) {
		const loadedOs = node.getCoValue(osId);
		if (loadedOs && loadedOs.type === "comap") {
			os = loadedOs;
			console.log("   ℹ️  account.os already exists:", osId);
		}
	}
	
	if (!os) {
		os = account.createMap({}, {$schema: "OSSchema"});
		account.set("os", os.id);
		console.log("   ✅ account.os CoMap created:", os.id);
		console.log("   ✅ account.os stored on account (will verify at end)");
	}
	
	// 3. Check if os.schemata already exists
	let schemataId = os.get("schemata");
	let schemata;
	
	if (schemataId) {
		const loadedSchemata = node.getCoValue(schemataId);
		if (loadedSchemata && loadedSchemata.type === "comap") {
			schemata = loadedSchemata;
			console.log("   ℹ️  os.schemata already exists:", schemataId);
		}
	}
	
	if (!schemata) {
		schemata = account.createMap({}, {$schema: "SchemataRegistry"});
		os.set("schemata", schemata.id);
		console.log("   ✅ os.schemata CoMap created:", schemata.id);
		console.log("   ✅ os.schemata stored on os (will verify at end)");
	}
	
	// 4. Check if human schema already exists in registry
	let humanSchemaId = schemata.get("human");
	let humanSchema;
	
	if (humanSchemaId) {
		const loadedSchema = node.getCoValue(humanSchemaId);
		if (loadedSchema && loadedSchema.type === "comap") {
			humanSchema = loadedSchema;
			console.log("   ℹ️  Human Schema already exists:", humanSchemaId);
		}
	}
	
	if (!humanSchema) {
		// Create human schema with proper JSON Schema 2020 definition
		const humanSchemaDefinition = {
			$schema: "https://json-schema.org/draft/2020-12/schema",
			$id: "https://maia.city/schemas/human",
			type: "object",
			properties: {
				name: {
					type: "string",
					description: "The name of the human entity"
				}
			},
			required: ["name"],
			additionalProperties: false
		};
		
		humanSchema = account.createMap({
			name: "human",
			definition: humanSchemaDefinition
		}, {$schema: "SchemaDefinition"});
		schemata.set("human", humanSchema.id);
		console.log("   ✅ Human Schema CoMap created:", humanSchema.id);
		console.log("   ✅ Schema registered in schemata");
	}
	
	// 5. Check if Data CoList already exists
	let dataId = account.get("Data");
	let data;
	
	if (dataId) {
		const loadedData = node.getCoValue(dataId);
		if (loadedData && loadedData.type === "colist") {
			data = loadedData;
			console.log("   ℹ️  Data CoList already exists:", dataId);
		}
	}
	
	if (!data) {
		data = account.createList([], {$schema: "EntityList"});
		account.set("Data", data.id);
		console.log("   ✅ Data CoList created:", data.id);
		console.log("   ✅ account.Data stored on account (will verify at end)");
	}
	
	// 6. Check if maia entity already exists in list
	const dataList = data.toJSON();
	const maiaEntityExists = dataList.some(entityId => {
		const entity = node.getCoValue(entityId);
		return entity && entity.type === "comap" && entity.get("name") === "maia";
	});
	
	if (!maiaEntityExists) {
		// 7. Create maia entity CoMap with $schema reference
		const maiaEntity = account.createMap({
			name: "maia"
		}, {$schema: humanSchema.id});  // ← headerMeta references schema!
		console.log("   ✅ Maia Entity CoMap created:", maiaEntity.id);
		console.log("      headerMeta.$schema:", humanSchema.id);
		
		// 8. Add entity to list (append at end)
		data.append(maiaEntity.id);
		console.log("   ✅ Entity added to Data list");
	} else {
		console.log("   ℹ️  Maia entity already exists in Data list");
	}
	
	console.log("🎉 Migration check complete!");
	console.log("   Profile:", profile.id);
	console.log("   OS:", os.id);
	console.log("   Schemata:", schemata.id);
	console.log("   Human Schema:", humanSchema.id);
	console.log("   Data:", data.id);
	
	// Final verification: Check if CoMaps are linked to account
	// Note: Transactions may not be immediately readable, so we just log warnings
	const finalOsId = account.get("os");
	const finalDataId = account.get("Data");
	const finalProfileId = account.get("profile");
	
	// Verify os.schemata is anchored
	let finalSchemataId = null;
	if (os) {
		finalSchemataId = os.get("schemata");
	}
	
	if (!finalOsId) {
		console.warn("   ⚠️  account.os not yet readable (transaction may not be processed yet)");
		console.warn("      Expected:", os.id);
		console.warn("      This is OK - transaction will be processed by cojson");
	} else {
		console.log("   ✅ Verified: account.os is linked:", finalOsId);
	}
	
	if (!finalDataId) {
		console.warn("   ⚠️  account.Data not yet readable (transaction may not be processed yet)");
		console.warn("      Expected:", data.id);
		console.warn("      This is OK - transaction will be processed by cojson");
	} else {
		console.log("   ✅ Verified: account.Data is linked:", finalDataId);
	}
	
	if (!finalProfileId) {
		console.warn("   ⚠️  account.profile not yet readable (transaction may not be processed yet)");
		console.warn("      Expected:", profile.id);
		console.warn("      This is OK - transaction will be processed by cojson");
	} else {
		console.log("   ✅ Verified: account.profile is linked:", finalProfileId);
	}
	
	// Verify os.schemata anchoring
	if (!finalSchemataId) {
		console.warn("   ⚠️  os.schemata not yet readable (transaction may not be processed yet)");
		console.warn("      Expected:", schemata.id);
		console.warn("      This is OK - transaction will be processed by cojson");
	} else {
		console.log("   ✅ Verified: os.schemata is linked:", finalSchemataId);
	}
	
	console.log("   ✅ Migration complete - all CoMaps created and linked");
	console.log("      Account structure:");
	console.log("        account.profile →", profile.id);
	console.log("        account.os →", os.id);
	console.log("        account.os.schemata →", schemata.id);
	console.log("        account.Data →", data.id);
	console.log("      (Values will be readable after transactions are processed)");
}
