#!/usr/bin/env node
/**
 * Hot-reload-aware asset sync script for @hominio/brand
 *
 * Syncs assets from libs/hominio-brand/src/assets to service static folders.
 * Runs in watch mode during development for hot reloading.
 *
 * Usage:
 *   node scripts/sync-assets.js          # One-time sync
 *   node scripts/sync-assets.js --watch  # Watch mode
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, watch } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Paths - script is now in scripts/ folder, so monorepo root is one level up
const monorepoRoot = resolve(__dirname, '..')
const brandAssetsDir = resolve(monorepoRoot, 'libs/hominio-brand/src/assets')

// Detect if we're in Docker build context (service copied to root) or normal monorepo
// In Docker: services/app/ . is copied to /app, so static/ is at /app/static/
// In monorepo: static/ is at services/app/static/
const isDockerContext =
	existsSync(resolve(monorepoRoot, 'package.json')) && !existsSync(resolve(monorepoRoot, 'services'))

// Get current working directory to detect which service we're building
const cwd = process.cwd()
const isMeService = cwd.includes('services/me') || (cwd.includes('me') && !cwd.includes('website'))
const isWalletService = cwd.includes('services/wallet-browser') || cwd.includes('wallet-browser')

const serviceStaticDirs = isDockerContext
	? [
			// Docker build context: sync to current service's static folder
			resolve(cwd, 'static/brand'),
		]
	: [
			// Normal monorepo context: sync to detected service(s) only
			// When running from monorepo root (!isDockerContext), include all services
			...(isMeService || !isDockerContext ? [resolve(monorepoRoot, 'services/me/static/brand')] : []),
			...(isWalletService || !isDockerContext ? [resolve(monorepoRoot, 'services/wallet-browser/public/brand')] : []),
		].filter(Boolean)

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
 * Sync all assets from brand package to services (preserves folder structure)
 */
function syncAllAssets() {
	console.log('🔄 Syncing brand assets to services...')

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
const isWatchMode = args.includes('--watch') || args.includes('-w')

// Initial sync
syncAllAssets()

// Watch mode
if (isWatchMode) {
	watchAssets()
	console.log('Press Ctrl+C to stop watching.\n')
} else {
	process.exit(0)
}
