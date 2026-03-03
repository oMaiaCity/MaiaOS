import { defineConfig } from 'vite'

export default defineConfig({
	base: './',
	build: {
		outDir: 'dist',
		assetsDir: 'assets',
	},
	optimizeDeps: {
		exclude: ['onnxruntime-web'],
	},
	server: {
		port: 5173,
		strictPort: true,
		headers: {
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp',
		},
	},
})
