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
					const content = readFileSync(filePath);
					const ext = extname(pathname);
					const mimeType = MIME_TYPES[ext] || "application/octet-stream";

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
			const indexHtml = readFileSync(join(DIST_DIR, "index.html"), "utf-8");
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
