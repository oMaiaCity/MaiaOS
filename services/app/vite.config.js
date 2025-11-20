import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	// Load env vars from monorepo root
	envDir: resolve(__dirname, '../..'),
	envPrefix: ['PUBLIC_'],
	resolve: {
		// Ensure proper module resolution in monorepo
		preserveSymlinks: false,
	},
	server: {
		host: process.env.TAURI_DEV_HOST || 'localhost',
		port: process.env.TAURI_DEV_PORT ? Number(process.env.TAURI_DEV_PORT) : 4202,
		strictPort: true,
		hmr: process.env.TAURI_DEV_HOST
			? {
					host: process.env.TAURI_DEV_HOST,
					port: process.env.TAURI_DEV_PORT ? Number(process.env.TAURI_DEV_PORT) : 4202,
					protocol: 'ws',
				}
			: undefined,
	},
});
