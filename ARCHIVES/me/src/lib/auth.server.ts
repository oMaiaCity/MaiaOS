import { betterAuth } from 'better-auth'
import { jazzPlugin } from 'jazz-tools/better-auth/auth/server'
import { JazzBetterAuthDatabaseAdapter } from 'jazz-tools/better-auth/database-adapter'
import { env } from '$env/dynamic/private'
import { env as publicEnv } from '$env/dynamic/public'
import { getBaseURL } from '$lib/utils/baseUrl'

// Get environment variables using SvelteKit's native env syntax
const BETTER_AUTH_SECRET = env.BETTER_AUTH_SECRET
const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || ''
const JAZZ_WORKER_ACCOUNT = env.JAZZ_WORKER_ACCOUNT
const JAZZ_WORKER_SECRET = env.JAZZ_WORKER_SECRET
const apiKey = publicEnv.PUBLIC_JAZZ_API_KEY

if (!BETTER_AUTH_SECRET) {
	throw new Error('BETTER_AUTH_SECRET environment variable is required')
}

if (!JAZZ_WORKER_ACCOUNT || !JAZZ_WORKER_SECRET) {
	throw new Error('JAZZ_WORKER_ACCOUNT and JAZZ_WORKER_SECRET environment variables are required')
}

// Better Auth configuration with Jazz native storage adapter
export const auth = betterAuth({
	plugins: [jazzPlugin()],
	database: JazzBetterAuthDatabaseAdapter({
		syncServer: `wss://cloud.jazz.tools/?key=${apiKey}`,
		accountID: JAZZ_WORKER_ACCOUNT,
		accountSecret: JAZZ_WORKER_SECRET,
	}),
	secret: BETTER_AUTH_SECRET,
	baseURL: getBaseURL(), // Uses PUBLIC_DOMAIN_ME or auto-detects
	// Configure Google OAuth if credentials are provided
	...(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
		? {
			socialProviders: {
				google: {
					clientId: GOOGLE_CLIENT_ID,
					clientSecret: GOOGLE_CLIENT_SECRET,
				},
			},
		}
		: {}),
})
