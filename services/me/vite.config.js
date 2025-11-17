import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		port: process.env.PORT ? Number(process.env.PORT) : 4200,
		strictPort: true,
	},
	build: {
		outDir: 'dist',
	},
});

