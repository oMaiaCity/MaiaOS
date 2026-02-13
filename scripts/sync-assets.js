#!/usr/bin/env node
/**
 * Asset sync for @maia/brand: libs/maia-brand/src/assets → target dir.
 *
 * Usage:
 *   bun scripts/sync-assets.js              # Dev: sync to services/maia/brand, watch
 *   bun scripts/sync-assets.js --no-watch   # One-time sync to services/maia/brand
 *   bun scripts/sync-assets.js --out <dir>  # Sync to custom dir (e.g. dist/brand for build)
 */

import {
	copyFileSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	rmSync,
	statSync,
	unlinkSync,
	watch,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const monorepoRoot = resolve(__dirname, '..')
const brandAssetsDir = resolve(monorepoRoot, 'libs/maia-brand/src/assets')
const defaultTarget = resolve(monorepoRoot, 'services/maia/brand')
const legacyMaiaCityDir = resolve(monorepoRoot, 'services/maia-city')
const legacyPublicBrandDir = resolve(monorepoRoot, 'services/maia/public')

const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const outDir =
	outIdx >= 0 && args[outIdx + 1] ? resolve(process.cwd(), args[outIdx + 1]) : defaultTarget
const serviceStaticDirs = [outDir]

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

	let _copied = false
	serviceStaticDirs.forEach((staticDir) => {
		try {
			const targetPath = join(staticDir, relativePath)
			const targetDir = dirname(targetPath)

			// Create directory if it doesn't exist (preserves subfolder structure)
			if (!existsSync(targetDir)) {
				mkdirSync(targetDir, { recursive: true })
			}

			copyFileSync(sourcePath, targetPath)
			_copied = true
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
 * Sync all assets from brand package to maia service (preserves folder structure)
 */
function syncAllAssets() {
	// Remove legacy dirs (no longer used - brand lives in services/maia/brand or dist/brand)
	if (existsSync(legacyMaiaCityDir)) {
		rmSync(legacyMaiaCityDir, { recursive: true, force: true })
	}
	if (existsSync(legacyPublicBrandDir)) {
		rmSync(legacyPublicBrandDir, { recursive: true, force: true })
	}
	// Replace symlink with real dir (brand may have been a symlink to public/brand)
	serviceStaticDirs.forEach((staticDir) => {
		if (existsSync(staticDir)) {
			try {
				const stat = lstatSync(staticDir)
				if (stat.isSymbolicLink()) {
					unlinkSync(staticDir)
				}
			} catch (_err) {}
		}
	})
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
			copyAssetToServices(filename)
		}
	})
}

// Main execution
const isNoWatch = args.includes('--no-watch') || args.includes('--no-w')

// Initial sync
syncAllAssets()

// Watch mode (enabled by default)
if (!isNoWatch) {
	watchAssets()
	console.log('[assets] Watching assets')
} else {
	process.exit(0)
}
