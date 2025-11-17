import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Use adapter-static for Tauri builds (iOS/desktop), adapter-node for web server (Fly.io)
// TAURI_BUILD is set in tauri.conf.json beforeBuildCommand when building for Tauri
// Tauri also sets TAURI_ENV_PLATFORM during hook commands (beforeDevCommand, beforeBuildCommand)
const isTauriBuild = process.env.TAURI_BUILD === '1' || process.env.TAURI_ENV_PLATFORM !== undefined;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		adapter: isTauriBuild
			? adapterStatic({
					// For Tauri: SPA mode with static files
					// See: https://v2.tauri.app/start/frontend/sveltekit/
					fallback: 'index.html'
				})
			: adapterNode({
					// For Fly.io web server: adapter-node automatically uses PORT and HOST env vars
					// PORT=3000 and HOST=0.0.0.0 are set in Dockerfile
					// Note: SSR is disabled (ssr = false in +layout.js), so this is also client-only
				})
	}
};

export default config;
