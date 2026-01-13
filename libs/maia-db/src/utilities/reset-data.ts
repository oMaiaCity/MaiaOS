/**
 * Utility function to clear all data from the database
 * 
 * Clears all items from the schemata, entities, actors, and vibes lists
 * Clears genesis field (entry point vibe)
 * Attempts to remove legacy vibesRegistryId field (if it exists)
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

	// 1. Clear schemata list (keep the list structure, just remove items)
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

	// 5. Clear vibes list (keep the list structure, just remove items)
	// Same pattern as actors - works perfectly
	if (root.$jazz.has('vibes')) {
		// Load vibes list
		const rootWithVibes = await root.$jazz.ensureLoaded({
			resolve: { vibes: true },
		})
		const vibesList = rootWithVibes.vibes

		if (vibesList?.$isLoaded) {
			// Get current length
			const currentLength = Array.from(vibesList).length

			// Remove all items by splicing from the end (safer than iterating forward)
			for (let i = currentLength - 1; i >= 0; i--) {
				vibesList.$jazz.splice(i, 1)
			}

			await root.$jazz.waitForSync()
		}
	}

	// 6. Clear genesis field (entry point vibe actor ID)
	// Use delete() method to remove the field completely
	if (root.$jazz.has('genesis')) {
		root.$jazz.delete('genesis')
		await root.$jazz.waitForSync()
	}

	// 7. Remove legacy vibesRegistryId field (if it exists)
	// Use delete() method - works even if field is not in schema
	if (root.$jazz.has('vibesRegistryId')) {
		root.$jazz.delete('vibesRegistryId')
		await root.$jazz.waitForSync()
	}
}

