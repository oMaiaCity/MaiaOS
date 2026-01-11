<script lang="ts">
import { Account } from 'jazz-tools'
import { onMount } from 'svelte'
import { browser } from '$app/environment'
import { authClient } from '$lib/auth-client'
	import { getAuthStorage, getJazzContext } from '$lib/utils/jazz-utils'

// Get JazzContext and AuthSecretStorage during component initialization
// (getContext() can only be called during initialization, not in onMount)
let jazzContext: any = null
let authSecretStorage: any = null

if (browser) {
	try {
		const jazzContextObj = getJazzContext()
		jazzContext = jazzContextObj.current || jazzContextObj
		authSecretStorage = getAuthStorage()
	} catch (_error) {}
}

// Set up the integration when component mounts (browser only)
onMount(async () => {
	if (!browser) return
	if (!authClient.jazz) {
		return
	}
	if (!jazzContext || !authSecretStorage) {
		return
	}

	try {
		// Ensure current account credentials are stored in authSecretStorage
		// This is critical - the Better Auth plugin needs credentials to be available
		const existingCredentials = await authSecretStorage.get()
		if (!existingCredentials) {
			// Get the current account (anonymous or authenticated)
			const currentAccount = Account.getMe()
			const accountID = currentAccount.$jazz.id
			const node = currentAccount.$jazz.localNode
			const agent = node.getCurrentAgent()
			const accountSecret = agent.agentSecret
			// For anonymous accounts, we don't have secretSeed, but that's okay
			// The plugin will work with just accountID and accountSecret

			// Store the credentials (even if anonymous) so the plugin can find them
			await authSecretStorage.set({
				accountID,
				accountSecret,
				provider: 'anonymous', // Will be updated to "better-auth" after sign-in
			})
			console.log('Stored anonymous account credentials in authSecretStorage')
		}

		// Set JazzContext and AuthSecretStorage as per docs
		authClient.jazz.setJazzContext(jazzContext)
		authClient.jazz.setAuthSecretStorage(authSecretStorage)
		console.log('Jazz integration setup complete')
	} catch (_error) {}
})
</script>
