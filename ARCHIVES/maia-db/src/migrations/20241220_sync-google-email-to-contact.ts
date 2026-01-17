/**
 * Migration: Sync Google Profile Email to Contact
 * Date: 2024-12-20
 * Description: Syncs BetterAuth Google profile email to root.contact.email
 *
 * IMPORTANT: Only syncs if contact.email is empty.
 * This ensures users can overwrite values, and Google will NEVER overwrite them back.
 */

/**
 * Syncs Google profile email to root.contact.email
 *
 * Behavior:
 * - Only updates if email is empty (preserves user edits)
 * - Never overwrites existing values (users can freely edit and Google won't overwrite)
 *
 * @param account - The Jazz account being migrated
 * @param googleEmail - The email from BetterAuth Google profile
 */
export async function migrateSyncGoogleEmailToContact(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	account: any,
	googleEmail?: string | null,
): Promise<void> {
	if (!googleEmail || !googleEmail.trim()) {
		console.log('[Migration] No Google email provided, skipping sync')
		return
	}

	console.log(`[Migration] Starting syncGoogleEmailToContact with email: ${googleEmail}`)
	try {
		// Ensure account root is loaded
		const loadedAccount = await account.$jazz.ensureLoaded({
			resolve: { root: { contact: true } },
		})

		if (!loadedAccount.root || !loadedAccount.root.$isLoaded) {
			console.log('[Migration] No root found, skipping sync')
			return
		}

		const root = loadedAccount.root
		const rootAny = root as any

		// Check if contact exists
		if (!rootAny.$jazz.has('contact')) {
			console.log("[Migration] Root doesn't have contact property yet, skipping sync")
			return
		}

		// Ensure contact is loaded
		const contact = rootAny.contact
		if (!contact || !contact.$isLoaded) {
			console.log('[Migration] Contact not loaded, skipping sync')
			return
		}

		const contactAny = contact as any

		// Get current email value
		const currentEmail = contactAny.email?.trim() || ''

		// Only sync if email is empty (don't overwrite user edits)
		if (currentEmail) {
			console.log(`[Migration] Contact already has email set (${currentEmail}), skipping sync`)
			return
		}

		// Update contact with Google email (only if empty)
		contactAny.$jazz.set('email', googleEmail.trim())

		console.log(`[Migration] Synced Google email to contact: email="${googleEmail}"`)
	} catch (_error) {
		// Don't throw - allow migration to continue
	}
}
