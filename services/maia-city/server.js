#!/usr/bin/env bun

/**
 * Simple static file server for maia-city
 * Serves the Vite-built SPA with proper routing
 */

import { serve } from "bun";
import { readFileSync, statSync, existsSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 8080;
const DIST_DIR = join(__dirname, "dist");

const MIME_TYPES = {
	".html": "text/html",
	".js": "application/javascript",
	".mjs": "application/javascript",
	".json": "application/json",
	".css": "text/css",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".map": "application/json",
};

serve({
	port: PORT,
	async fetch(req) {
		const url = new URL(req.url);
		let pathname = url.pathname;

		// Security: prevent directory traversal
		if (pathname.includes("..")) {
			return new Response("Forbidden", { status: 403 });
		}

		// Try to serve static file
		const filePath = join(DIST_DIR, pathname === "/" ? "index.html" : pathname);

		// Check if it's a file
		if (existsSync(filePath)) {
			try {
				const stats = statSync(filePath);
				if (stats.isFile()) {
					let content = readFileSync(filePath);
					const ext = extname(filePath); // Use filePath, not pathname, to get correct extension
					const mimeType = MIME_TYPES[ext] || "application/octet-stream";

					// Inject runtime env vars into HTML files
					if (ext === ".html" && content instanceof Buffer) {
						let htmlContent = content.toString("utf-8");
						let PUBLIC_API_DOMAIN = process.env.PUBLIC_API_DOMAIN || '';
						
						// If on custom domain and no explicit API domain, infer it
						// This handles the case where we're on next.maia.city but PUBLIC_API_DOMAIN isn't set
						// The client-side code will also infer, but setting it here ensures consistency
						if (!PUBLIC_API_DOMAIN) {
							// Note: We can't access req.headers.host here easily, so let client-side handle inference
							// But we can still inject empty string which triggers client-side inference
						}
						
						if (PUBLIC_API_DOMAIN) {
							const envScript = `<script>window.__PUBLIC_API_DOMAIN__="${PUBLIC_API_DOMAIN}";</script>`;
							htmlContent = htmlContent.replace('</head>', `${envScript}</head>`);
							content = htmlContent;
						}
					}

					return new Response(content, {
						headers: {
							"Content-Type": mimeType,
							"Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000",
						},
					});
				}
			} catch (error) {
				// Fall through to SPA fallback
			}
		}

		// SPA fallback: serve index.html for all routes (client-side routing)
		try {
			let indexHtml = readFileSync(join(DIST_DIR, "index.html"), "utf-8");
			
			// Inject runtime environment variables into HTML
			// This allows Fly.io secrets to be used at runtime
			// PUBLIC_API_DOMAIN is REQUIRED for production sync to work
			const PUBLIC_API_DOMAIN = process.env.PUBLIC_API_DOMAIN || '';
			if (PUBLIC_API_DOMAIN) {
				// Inject script before closing </head> tag to set env var
				const envScript = `<script>window.__PUBLIC_API_DOMAIN__="${PUBLIC_API_DOMAIN}";</script>`;
				indexHtml = indexHtml.replace('</head>', `${envScript}</head>`);
			} else {
				// Warn in production if PUBLIC_API_DOMAIN is not set
				if (process.env.NODE_ENV === 'production') {
					console.warn('⚠️  WARNING: PUBLIC_API_DOMAIN not set! Sync will use same-origin fallback (may not work).');
				}
			}
			
			return new Response(indexHtml, {
				headers: {
					"Content-Type": "text/html",
					"Cache-Control": "no-cache",
				},
			});
		} catch (error) {
			return new Response("Not Found", { status: 404 });
		}
	},
});

console.log(`🚀 Maia City server running on http://localhost:${PORT}`);
console.log(`📁 Serving from: ${DIST_DIR}`);
