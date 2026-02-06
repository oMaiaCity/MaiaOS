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

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, watch, unlinkSync, rmSync } from 'node:fs'
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
 * Remove a single asset from all service static directories
 */
function removeAssetFromServices(relativePath) {
	serviceStaticDirs.forEach((staticDir) => {
		try {
			const targetPath = join(staticDir, relativePath)
			if (existsSync(targetPath)) {
				const stat = statSync(targetPath)
				if (stat.isFile()) {
					unlinkSync(targetPath)
					// Individual removal logs removed - only show summary at end
				} else if (stat.isDirectory()) {
					rmSync(targetPath, { recursive: true, force: true })
					// Individual removal logs removed - only show summary at end
				}
			}
		} catch (_err) {}
	})
}

/**
 * Copy a single file to all service static directories (preserves subfolder structure)
 */
function copyAssetToServices(relativePath) {
	const sourcePath = resolve(brandAssetsDir, relativePath)

	// If source doesn't exist, remove from destination
	if (!existsSync(sourcePath)) {
		removeAssetFromServices(relativePath)
		return
	}

	// Skip if not a file (it might be a directory change event)
	if (!statSync(sourcePath).isFile()) {
		return
	}

	let copied = false
	serviceStaticDirs.forEach((staticDir) => {
		try {
			const targetPath = join(staticDir, relativePath)
			const targetDir = dirname(targetPath)

			// Create directory if it doesn't exist (preserves subfolder structure)
			if (!existsSync(targetDir)) {
				mkdirSync(targetDir, { recursive: true })
			}

			copyFileSync(sourcePath, targetPath)
			copied = true
			// Individual file logs removed - only show summary at end
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
	// Sync status handled by dev.js logger
	if (!existsSync(brandAssetsDir)) {
		return
	}

	// 1. Copy/Update all source files to destination
	const sourceFiles = getAllFiles(brandAssetsDir)
	sourceFiles.forEach((relativePath) => {
		copyAssetToServices(relativePath)
	})

	// 2. Clean up destination files that don't exist in source anymore
	serviceStaticDirs.forEach((staticDir) => {
		if (!existsSync(staticDir)) return

		const destFiles = getAllFiles(staticDir)
		destFiles.forEach((relativePath) => {
			const sourcePath = resolve(brandAssetsDir, relativePath)
			if (!existsSync(sourcePath)) {
				const destPath = join(staticDir, relativePath)
				try {
					unlinkSync(destPath)
					// Individual cleanup logs removed - only show summary at end
				} catch (_err) {}
			}
		})
	})

	// Success message handled by dev.js logger
}

/**
 * Watch assets directory for changes (recursive)
 */
function watchAssets() {
	// Watch status handled by dev.js logger
	watch(brandAssetsDir, { recursive: true }, (_eventType, filename) => {
		if (filename && !filename.startsWith('.')) {
			// Sync silently
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
	// Status handled by dev.js
} else {
	process.exit(0)
}
