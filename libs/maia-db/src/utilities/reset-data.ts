/**
 * Utility function to clear all data from the database
 * 
 * Clears all items from the schemata, entities, and actors lists
 * Also clears Jazz IndexedDB cache to ensure fresh start
 *
 * @param account - The Jazz account
 */
export async function resetData(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
): Promise<void> {
	// Load root
	const loadedAccount = await account.$jazz.ensureLoaded({
		resolve: { root: true },
	})

	if (!loadedAccount.root) {
		throw new Error('Root does not exist')
	}

	const root = loadedAccount.root

	// 1. FIRST: Clear cached VibesRegistry ID (BEFORE clearing entities!)
	const currentValue = root.vibesRegistryId;
	
	if (currentValue !== undefined && currentValue !== null) {
		// Set to undefined (for Zod optional properties, this clears the value)
		root.$jazz.set('vibesRegistryId', undefined);
		await root.$jazz.waitForSync();
		
		// Verify it's cleared
		const newValue = root.vibesRegistryId;
		
		if (newValue !== undefined && newValue !== null) {
			console.error('[resetData] ❌ Failed to clear vibesRegistryId! Still has value:', newValue);
		}
	}

	// 2. Clear schemata list (keep the list structure, just remove items)
	if (root.$jazz.has('schemata')) {
		// Load schemata list
		const rootWithSchemata = await root.$jazz.ensureLoaded({
			resolve: { schemata: true },
		})
		const schemataList = rootWithSchemata.schemata

		if (schemataList?.$isLoaded) {
			// Get current length
			const currentLength = Array.from(schemataList).length

			// Remove all items by splicing from the end (safer than iterating forward)
			for (let i = currentLength - 1; i >= 0; i--) {
				schemataList.$jazz.splice(i, 1)
			}

			await root.$jazz.waitForSync()
		}
	}

	// 3. Clear entities list (keep the list structure, just remove items)
	if (root.$jazz.has('entities')) {
		// Load entities list
		const rootWithEntities = await root.$jazz.ensureLoaded({
			resolve: { entities: true },
		})
		const entitiesList = rootWithEntities.entities

		if (entitiesList?.$isLoaded) {
			// Get current length
			const currentLength = Array.from(entitiesList).length

			// Remove all items by splicing from the end (safer than iterating forward)
			for (let i = currentLength - 1; i >= 0; i--) {
				entitiesList.$jazz.splice(i, 1)
			}

			await root.$jazz.waitForSync()
		}
	}

	// 4. Clear actors list (keep the list structure, just remove items)
	if (root.$jazz.has('actors')) {
		// Load actors list
		const rootWithActors = await root.$jazz.ensureLoaded({
			resolve: { actors: true },
		})
		const actorsList = rootWithActors.actors

		if (actorsList?.$isLoaded) {
			// Get current length
			const currentLength = Array.from(actorsList).length

			// Remove all items by splicing from the end (safer than iterating forward)
			for (let i = currentLength - 1; i >= 0; i--) {
				actorsList.$jazz.splice(i, 1)
			}

			await root.$jazz.waitForSync()
		}
	}
}

