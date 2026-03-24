#!/usr/bin/env bun
/**
 * Game dev server: Bun HTML bundle + HMR for `main.js`, workspace `@MaiaOS/game`, and linked CSS.
 *
 * Do not add a catch-all `fetch` that serves index HTML for unknown paths — that shadows the
 * bundled `/main.js` (and other graph assets), so the page stays blank and HMR never attaches.
 */
import index from './index.html'

const PORT = Number(process.env.PORT) || 4202

Bun.serve({
	port: PORT,
	strictPort: true,
	development: { hmr: true, console: true },
	routes: {
		'/': index,
	},
})

console.log(`Local: http://localhost:${PORT}/ (HMR)`)
