import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// Explicitly configure for Fly.io
			// adapter-node automatically uses PORT and HOST env vars
			// PORT=3000 and HOST=0.0.0.0 are set in Dockerfile
		})
	}
};

export default config;
