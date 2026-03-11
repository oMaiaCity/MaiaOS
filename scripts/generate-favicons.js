#!/usr/bin/env bun

/**
 * Generate favicons using @realfavicongenerator/generate-favicon Node.js API
 * Outputs ONLY to libs/maia-brand/src/assets/favicon/ (brand package)
 *
 * Runs library with cwd=faviconDir so any cwd-relative ghost dirs stay inside brand package.
 * Removes ghost dirs at repo root before and after (library/deps may create them).
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	generateFaviconFiles,
	generateFaviconHtml,
	IconTransformationType,
} from '@realfavicongenerator/generate-favicon'
import { getNodeImageAdapter, loadAndConvertToSvg } from '@realfavicongenerator/image-adapter-node'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const faviconDir = resolve(rootDir, 'libs/maia-brand/src/assets/favicon')
const logoPath = resolve(rootDir, 'libs/maia-brand/src/assets/logo_dark.svg')
const logoDarkPath = resolve(rootDir, 'libs/maia-brand/src/assets/logo.svg')

// Ensure favicon directory exists
if (!existsSync(faviconDir)) {
	mkdirSync(faviconDir, { recursive: true })
}

const ghostDirs = [resolve(rootDir, 'services/maia'), resolve(rootDir, 'services/maia-city')]
function removeGhostDirs() {
	for (const d of ghostDirs) {
		try {
			if (existsSync(d)) rmSync(d, { recursive: true, force: true })
		} catch (_) {}
	}
}

async function generateFavicons() {
	removeGhostDirs()
	const origCwd = process.cwd()
	try {
		// Run library with cwd=faviconDir so any cwd-relative writes go inside brand package
		process.chdir(faviconDir)

		// Get image adapter
		const imageAdapter = await getNodeImageAdapter()

		// Load master icons (use absolute paths - not affected by chdir)
		// logo_dark.svg is for light backgrounds (main icon)
		// logo.svg is for dark backgrounds (darkIcon)
		const masterIcon = {
			icon: await loadAndConvertToSvg(logoDarkPath, imageAdapter),
			darkIcon: await loadAndConvertToSvg(logoPath, imageAdapter),
		}

		// Configure favicon settings
		const faviconSettings = {
			icon: {
				desktop: {
					regularIconTransformation: {
						type: IconTransformationType.None,
					},
					darkIconType: 'specific',
					darkIconTransformation: {
						type: IconTransformationType.None,
					},
				},
				touch: {
					transformation: {
						type: IconTransformationType.Background,
						backgroundColor: '#e3e9ec',
						backgroundRadius: 0,
						imageScale: 0.7,
					},
					appTitle: 'MaiaCity',
				},
				webAppManifest: {
					transformation: {
						type: IconTransformationType.Background,
						backgroundColor: '#e3e9ec',
						backgroundRadius: 0,
						imageScale: 0.6,
					},
					backgroundColor: '#ffffff',
					themeColor: '#e3e9ec',
					name: 'Maia City',
					shortName: 'MaiaCity',
				},
			},
			path: '/brand/favicon/',
		}

		// Generate favicon files (library returns buffers; we write to brand package only)
		const files = await generateFaviconFiles(masterIcon, faviconSettings, imageAdapter)

		// Restore cwd before writing (we use absolute paths)
		process.chdir(origCwd)

		// Write ONLY to libs/maia-brand/src/assets/favicon/
		for (const [fileName, contents] of Object.entries(files)) {
			if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
				throw new Error(`[favicons] Invalid fileName from library: ${fileName}`)
			}
			writeFileSync(resolve(faviconDir, fileName), contents)
		}

		// Generate HTML markup (optional - for reference)
		try {
			const html = await generateFaviconHtml(faviconSettings)
			const htmlString = typeof html === 'string' ? html : String(html)
			writeFileSync(resolve(faviconDir, 'favicon-markup.html'), htmlString)
		} catch (_htmlError) {
			// Non-fatal
		}

		console.log('[favicons] ✓ All favicons generated successfully!')
	} catch (_error) {
		// Don't throw - make it non-fatal so dev server can continue
	} finally {
		process.chdir(origCwd)
		removeGhostDirs()
		// Also remove if created inside faviconDir
		try {
			for (const rel of ['services/maia', 'services/maia-city']) {
				const d = resolve(faviconDir, rel)
				if (existsSync(d)) rmSync(d, { recursive: true, force: true })
			}
		} catch (_) {}
	}
}

generateFavicons()
