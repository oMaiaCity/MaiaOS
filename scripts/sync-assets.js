#!/usr/bin/env node
/**
 * Hot-reload-aware asset sync script for @maia/brand
 *
 * Syncs assets from libs/maia-brand/src/assets to maia-city service static folder.
 * Runs in watch mode during development for hot reloading.
 *
 * Usage:
 *   node scripts/sync-assets.js          # Sync and watch (default)
 *   node scripts/sync-assets.js --no-watch  # One-time sync only
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, watch } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Paths - script is now in scripts/ folder, so monorepo root is one level up
const monorepoRoot = resolve(__dirname, '..')
const brandAssetsDir = resolve(monorepoRoot, 'libs/maia-brand/src/assets')

// Sync assets to maia-city service only
// Vite serves static files from 'public' directory by default
const serviceStaticDirs = [
	resolve(monorepoRoot, 'services/maia-city/public/brand'),
]

/**
 * Copy a single file to all service static directories (preserves subfolder structure)
 */
function copyAssetToServices(relativePath) {
	const sourcePath = resolve(brandAssetsDir, relativePath)

	// Skip if not a file
	if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
		return
	}

	let copied = false
	serviceStaticDirs.forEach((staticDir) => {
		try {
			const targetPath = join(staticDir, relativePath)
			const targetDir = dirname(targetPath) // Use path.dirname() for cross-platform compatibility

			// Create directory if it doesn't exist (preserves subfolder structure)
			if (!existsSync(targetDir)) {
				mkdirSync(targetDir, { recursive: true })
			}

			copyFileSync(sourcePath, targetPath)

			if (!copied) {
				console.log(`✅ Synced: ${relativePath}`)
				copied = true
			}
		} catch (_err) {}
	})
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dirPath, basePath = '') {
	const files = []
	const entries = readdirSync(dirPath)

	entries.forEach((entry) => {
		if (entry.startsWith('.')) return // Skip hidden files

		const fullPath = join(dirPath, entry)
		const relativePath = basePath ? join(basePath, entry) : entry
		const stat = statSync(fullPath)

		if (stat.isDirectory()) {
			// Recursively get files from subdirectory
			files.push(...getAllFiles(fullPath, relativePath))
		} else if (stat.isFile()) {
			files.push(relativePath)
		}
	})

	return files
}

/**
 * Sync all assets from brand package to maia-city service (preserves folder structure)
 */
function syncAllAssets() {
	console.log('🔄 Syncing brand assets to maia-city...')

	if (!existsSync(brandAssetsDir)) {
		return
	}

	// Get all files recursively
	const files = getAllFiles(brandAssetsDir)

	files.forEach((relativePath) => {
		copyAssetToServices(relativePath)
	})

	console.log('✅ All brand assets synced!\n')
}

/**
 * Watch assets directory for changes (recursive)
 */
function watchAssets() {
	console.log('👀 Watching brand assets for changes...\n')

	watch(brandAssetsDir, { recursive: true }, (_eventType, filename) => {
		if (filename && !filename.startsWith('.')) {
			console.log(`📁 Asset changed: ${filename}`)
			copyAssetToServices(filename)
		}
	})
}

// Main execution
const args = process.argv.slice(2)
const isNoWatch = args.includes('--no-watch') || args.includes('--no-w')

// Initial sync
syncAllAssets()

// Watch mode (enabled by default)
if (!isNoWatch) {
	watchAssets()
	console.log('Press Ctrl+C to stop watching.\n')
} else {
	process.exit(0)
}
