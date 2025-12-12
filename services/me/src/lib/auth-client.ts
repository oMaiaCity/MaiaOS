import { createAuthClient } from 'better-auth/svelte'
import { jazzPluginClient } from 'jazz-tools/better-auth/auth/client'
import { getBaseURL } from '$lib/utils/baseUrl'

export const authClient = createAuthClient({
	baseURL: getBaseURL(),
	plugins: [jazzPluginClient()],
})
