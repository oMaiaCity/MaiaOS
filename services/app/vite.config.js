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
        alias: {
            // Ensure workspace packages resolve correctly during build
            '@hominio/vibes': resolve(__dirname, '../../libs/hominio-vibes/src'),
            '@hominio/voice': resolve(__dirname, '../../libs/hominio-voice/src'),
            '@hominio/brand': resolve(__dirname, '../../libs/hominio-brand/src'),
            '@hominio/brand/views': resolve(__dirname, '../../libs/hominio-brand/src/views')
        }
    },
    server: {
        host: process.env.TAURI_DEV_HOST || 'localhost',
        port: process.env.TAURI_DEV_PORT ? Number(process.env.TAURI_DEV_PORT) : 4202,
        strictPort: true,
        fs: {
            // Allow access to workspace packages and monorepo root
            allow: ['..', '../..', '../../libs']
        },
        hmr: process.env.TAURI_DEV_HOST
            ? {
                    host: process.env.TAURI_DEV_HOST,
                    port: process.env.TAURI_DEV_PORT ? Number(process.env.TAURI_DEV_PORT) : 4202,
                    protocol: 'ws',
                }
            : undefined,
    },
});
