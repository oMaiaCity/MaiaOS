#!/usr/bin/env bun

/**
 * Generate favicons using @realfavicongenerator/generate-favicon Node.js API
 * Outputs to libs/maia-brand/src/assets/favicon/
 * 
 * logo_dark.svg is for light backgrounds (used as main icon)
 * logo.svg is for dark backgrounds (used as darkIcon)
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { generateFaviconFiles, generateFaviconHtml, IconTransformationType } from '@realfavicongenerator/generate-favicon'
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
		console.log('[favicons] Generating favicons from logo files...')
		console.log(`[favicons] Source (light bg): ${logoPath}`)
		console.log(`[favicons] Source (dark bg): ${logoDarkPath}`)
		console.log(`[favicons] Output: ${faviconDir}`)

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
					darkIconType: "specific",
					darkIconTransformation: {
						type: IconTransformationType.None,
					},
				},
				touch: {
					transformation: {
						type: IconTransformationType.Background,
						backgroundColor: "#e3e9ec",
						backgroundRadius: 0,
						imageScale: 0.7,
					},
					appTitle: "MaiaCity"
				},
				webAppManifest: {
					transformation: {
						type: IconTransformationType.Background,
						backgroundColor: "#e3e9ec",
						backgroundRadius: 0,
						imageScale: 0.6,
					},
					backgroundColor: "#ffffff",
					themeColor: "#e3e9ec",
					name: "Maia City",
					shortName: "MaiaCity"
				}
			},
			path: "/brand/favicon/",
		}

		// Generate favicon files
		const files = await generateFaviconFiles(masterIcon, faviconSettings, imageAdapter)

		// Write files to output directory
		// files is an object with file names as keys and contents as values
		for (const [fileName, contents] of Object.entries(files)) {
			const filePath = resolve(faviconDir, fileName)
			writeFileSync(filePath, contents)
			console.log(`[favicons] ✅ Generated: ${fileName}`)
		}

		// Generate HTML markup (optional - for reference)
		try {
			const html = await generateFaviconHtml(faviconSettings)
			const htmlPath = resolve(faviconDir, 'favicon-markup.html')
			// Ensure html is a string
			const htmlString = typeof html === 'string' ? html : String(html)
			writeFileSync(htmlPath, htmlString)
			console.log(`[favicons] ✅ Generated HTML markup: favicon-markup.html`)
		} catch (htmlError) {
			console.warn('[favicons] ⚠️  Could not generate HTML markup:', htmlError.message)
			// Non-fatal - continue
		}

		console.log('[favicons] ✅ All favicons generated successfully!')
	} catch (error) {
		console.error('[favicons] ❌ Failed to generate favicons:', error.message)
		console.error('[favicons] Stack:', error.stack)
		console.warn('[favicons] Dev server will continue - existing favicons will be used')
		// Don't throw - make it non-fatal so dev server can continue
	}
}

generateFavicons()
