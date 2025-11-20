#!/usr/bin/env node
/**
 * Hot-reload-aware asset sync script for @hominio/brand
 * 
 * Syncs assets from libs/hominio-brand/src/assets to service static folders.
 * Runs in watch mode during development for hot reloading.
 * 
 * Usage:
 *   node libs/hominio-brand/scripts/sync-assets.js          # One-time sync
 *   node libs/hominio-brand/scripts/sync-assets.js --watch  # Watch mode
 */

import { watch } from 'fs';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Paths
const brandAssetsDir = resolve(__dirname, '../src/assets');
const monorepoRoot = resolve(__dirname, '../../..');
const serviceStaticDirs = [
	resolve(monorepoRoot, 'services/app/static/brand'),
	resolve(monorepoRoot, 'services/wallet/static/brand'),
	resolve(monorepoRoot, 'services/website/public/brand'),
];

/**
 * Copy a single file to all service static directories (preserves subfolder structure)
 */
function copyAssetToServices(relativePath) {
	const sourcePath = resolve(brandAssetsDir, relativePath);
	
	// Skip if not a file
	if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
		return;
	}
	
	let copied = false;
	serviceStaticDirs.forEach(staticDir => {
		try {
			const targetPath = join(staticDir, relativePath);
			const targetDir = dirname(targetPath); // Use path.dirname() for cross-platform compatibility
			
			// Create directory if it doesn't exist (preserves subfolder structure)
			if (!existsSync(targetDir)) {
				mkdirSync(targetDir, { recursive: true });
			}
			
			copyFileSync(sourcePath, targetPath);
			
			if (!copied) {
				console.log(`✅ Synced: ${relativePath}`);
				copied = true;
			}
		} catch (err) {
			console.error(`❌ Error copying ${relativePath} to ${staticDir}:`, err.message);
		}
	});
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dirPath, basePath = '') {
	const files = [];
	const entries = readdirSync(dirPath);
	
	entries.forEach(entry => {
		if (entry.startsWith('.')) return; // Skip hidden files
		
		const fullPath = join(dirPath, entry);
		const relativePath = basePath ? join(basePath, entry) : entry;
		const stat = statSync(fullPath);
		
		if (stat.isDirectory()) {
			// Recursively get files from subdirectory
			files.push(...getAllFiles(fullPath, relativePath));
		} else if (stat.isFile()) {
			files.push(relativePath);
		}
	});
	
	return files;
}

/**
 * Sync all assets from brand package to services (preserves folder structure)
 */
function syncAllAssets() {
	console.log('🔄 Syncing brand assets to services...');
	
	if (!existsSync(brandAssetsDir)) {
		console.error(`❌ Brand assets directory not found: ${brandAssetsDir}`);
		return;
	}
	
	// Get all files recursively
	const files = getAllFiles(brandAssetsDir);
	
	files.forEach(relativePath => {
		copyAssetToServices(relativePath);
	});
	
	console.log('✅ All brand assets synced!\n');
}

/**
 * Watch assets directory for changes (recursive)
 */
function watchAssets() {
	console.log('👀 Watching brand assets for changes...\n');
	
	watch(brandAssetsDir, { recursive: true }, (eventType, filename) => {
		if (filename && !filename.startsWith('.')) {
			console.log(`📁 Asset changed: ${filename}`);
			copyAssetToServices(filename);
		}
	});
}

// Main execution
const args = process.argv.slice(2);
const isWatchMode = args.includes('--watch') || args.includes('-w');

// Initial sync
syncAllAssets();

// Watch mode
if (isWatchMode) {
	watchAssets();
	console.log('Press Ctrl+C to stop watching.\n');
} else {
	process.exit(0);
}

