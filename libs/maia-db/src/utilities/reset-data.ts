/**
 * Utility function to clear all data from the database
 * 
 * Clears all items from the schemata and entities lists
 * Also clears Jazz IndexedDB cache to ensure fresh start
 *
 * @param account - The Jazz account
 */
export async function resetData(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
): Promise<void> {
	console.log('[resetData] ===== STARTING DATABASE RESET =====');
	// Load root
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: { root: true },
	})

	if (!loadedAccount.root) {
		throw new Error('Root does not exist')
	}

	const root = loadedAccount.root

	// 1. FIRST: Clear cached VibesRegistry ID (BEFORE clearing entities!)
	console.log('[resetData] Step 1: Clearing cached vibesRegistryId...');
	const currentValue = root.vibesRegistryId;
	console.log('[resetData] Current vibesRegistryId value:', currentValue);
	
	if (currentValue !== undefined && currentValue !== null) {
		console.log('[resetData] Clearing cached vibesRegistryId:', currentValue);
		
		// Set to undefined (for Zod optional properties, this clears the value)
		root.$jazz.set('vibesRegistryId', undefined);
		await root.$jazz.waitForSync();
		
		// Verify it's cleared
		const newValue = root.vibesRegistryId;
		console.log('[resetData] After clear, vibesRegistryId is now:', newValue);
		
		if (newValue === undefined || newValue === null) {
			console.log('[resetData] ✅ vibesRegistryId cleared successfully');
		} else {
			console.error('[resetData] ❌ Failed to clear vibesRegistryId! Still has value:', newValue);
		}
	} else {
		console.log('[resetData] vibesRegistryId already empty (undefined or null)');
	}

	// 2. Clear schemata list (keep the list structure, just remove items)
	console.log('[resetData] Step 2: Clearing schemata list...');
	if (root.$jazz.has('schemata')) {
		// Load schemata list
		const rootWithSchemata = await root.$jazz.ensureLoaded({
			resolve: { schemata: true },
		})
		const schemataList = rootWithSchemata.schemata

		if (schemataList?.$isLoaded) {
			// Get current length and log schema names for debugging
			const currentLength = Array.from(schemataList).length
			const schemaNames = Array.from(schemataList).map((s: any) => s?.name || 'unnamed').join(', ');
			console.log('[resetData] Found', currentLength, 'schemas:', schemaNames);

			// Remove all items by splicing from the end (safer than iterating forward)
			for (let i = currentLength - 1; i >= 0; i--) {
				const schema = schemataList[i] as any;
				console.log(`[resetData] Removing schema ${i}:`, schema?.name || 'unnamed', schema?.$jazz?.id);
				schemataList.$jazz.splice(i, 1)
			}

			await root.$jazz.waitForSync()
			
			// Verify it's empty
			const remainingCount = Array.from(schemataList).length;
			console.log('[resetData] After clear, remaining schemas:', remainingCount);
			console.log('[resetData] ✅ Schemata list cleared');
		}
	} else {
		console.log('[resetData] No schemata list found');
	}

	// 3. Clear entities list (keep the list structure, just remove items)
	console.log('[resetData] Step 3: Clearing entities list...');
	if (root.$jazz.has('entities')) {
		// Load entities list
		const rootWithEntities = await root.$jazz.ensureLoaded({
			resolve: { entities: true },
		})
		const entitiesList = rootWithEntities.entities

		if (entitiesList?.$isLoaded) {
			// Get current length
			const currentLength = Array.from(entitiesList).length
			console.log('[resetData] Found', currentLength, 'entities');

			// Remove all items by splicing from the end (safer than iterating forward)
			for (let i = currentLength - 1; i >= 0; i--) {
				const entity = entitiesList[i] as any;
				console.log(`[resetData] Removing entity ${i}:`, entity?.$jazz?.id);
				entitiesList.$jazz.splice(i, 1)
			}

			await root.$jazz.waitForSync()
			
			// Verify it's empty
			const remainingCount = Array.from(entitiesList).length;
			console.log('[resetData] After clear, remaining entities:', remainingCount);
			console.log('[resetData] ✅ Entities list cleared');
		}
	} else {
		console.log('[resetData] No entities list found');
	}
	
	console.log('[resetData] ===== DATABASE RESET COMPLETE =====');
	console.log('[resetData] ✅ All data cleared using Jazz-native methods');
	console.log('[resetData] 💡 Jazz will handle cache/IndexedDB cleanup automatically');
}

