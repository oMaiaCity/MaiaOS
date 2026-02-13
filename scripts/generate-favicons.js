#!/usr/bin/env bun

/**
 * Generate favicons using @realfavicongenerator/generate-favicon Node.js API
 * Outputs to libs/maia-brand/src/assets/favicon/
 *
 * logo_dark.svg is for light backgrounds (used as main icon)
 * logo.svg is for dark backgrounds (used as darkIcon)
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
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

const logoPath = resolve(rootDir, 'libs/maia-brand/src/assets/logo_dark.svg') // For light backgrounds
const logoDarkPath = resolve(rootDir, 'libs/maia-brand/src/assets/logo.svg') // For dark backgrounds
const faviconDir = resolve(rootDir, 'libs/maia-brand/src/assets/favicon')

// Ensure favicon directory exists
if (!existsSync(faviconDir)) {
	mkdirSync(faviconDir, { recursive: true })
}

async function generateFavicons() {
	try {
		// Get image adapter
		const imageAdapter = await getNodeImageAdapter()

		// Load master icons
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

		// Generate favicon files
		const files = await generateFaviconFiles(masterIcon, faviconSettings, imageAdapter)

		// Write files to output directory
		// files is an object with file names as keys and contents as values
		for (const [fileName, contents] of Object.entries(files)) {
			const filePath = resolve(faviconDir, fileName)
			writeFileSync(filePath, contents)
			// Individual file logs removed - only show summary at end
		}

		// Generate HTML markup (optional - for reference)
		try {
			const html = await generateFaviconHtml(faviconSettings)
			const htmlPath = resolve(faviconDir, 'favicon-markup.html')
			// Ensure html is a string
			const htmlString = typeof html === 'string' ? html : String(html)
			writeFileSync(htmlPath, htmlString)
			// HTML markup log removed - only show summary at end
		} catch (_htmlError) {
			// Non-fatal - continue silently
		}

		console.log('[favicons] ✓ All favicons generated successfully!')
	} catch (_error) {
		// Don't throw - make it non-fatal so dev server can continue
	}
}

generateFavicons()
