import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Detect Docker context: in Docker, libs are at ./libs, locally at ../../libs
const isDocker = existsSync(resolve(__dirname, './libs'))
const libsPath = isDocker ? './libs' : '../../libs'

export default defineConfig({
	plugins: [sveltekit()],
	// Load env vars from monorepo root
	envDir: resolve(__dirname, '../..'),
	envPrefix: ['PUBLIC_'],
	resolve: {
		// Ensure proper module resolution in monorepo
		preserveSymlinks: false,
		alias: {
			'@maia/brand': resolve(__dirname, `${libsPath}/maia-brand/src`),
		},
	},
	server: {
		port: 4200,
		strictPort: true, // Fail if port is already in use
		fs: {
			// Allow access to workspace packages and monorepo root
			allow: ['..', '../..', '../../libs'],
		},
	},
})
