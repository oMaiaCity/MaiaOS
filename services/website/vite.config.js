import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss()],
	server: {
		port: process.env.PORT ? Number(process.env.PORT) : 4200,
		strictPort: true,
	},
	build: {
		outDir: 'dist',
	},
});

