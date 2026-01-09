/**
 * Utility function to clear all data from the database
 * 
 * Clears all items from the schemata and entities lists
 * Keeps the list structures intact
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

	// Clear schemata list (keep the list structure, just remove items)
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

	// Clear entities list (keep the list structure, just remove items)
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
}

