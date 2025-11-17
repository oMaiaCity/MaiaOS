import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	server: {
		host: process.env.TAURI_DEV_HOST || 'localhost',
		port: process.env.TAURI_DEV_PORT ? Number(process.env.TAURI_DEV_PORT) : 4201,
		strictPort: true,
		hmr: process.env.TAURI_DEV_HOST
			? {
					host: process.env.TAURI_DEV_HOST,
					port: process.env.TAURI_DEV_PORT ? Number(process.env.TAURI_DEV_PORT) : 4201,
					protocol: 'ws',
				}
			: undefined,
	},
});
