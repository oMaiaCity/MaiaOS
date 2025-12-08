#!/usr/bin/env node
/**
 * Centralized version sync script for monorepo
 * Syncs version across:
 * - All services package.json files (excluding app, wallet, website, zero, sync)
 * - All libs package.json files
 * 
 * Note: Tauri/platform-specific files (Cargo.toml, tauri.conf.json, iOS files) are NOT synced
 * as the app service is kept for reference only and not actively maintained.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Get version from command line or from services/me/package.json (source of truth)
const newVersion = process.argv[2] || JSON.parse(readFileSync(join(rootDir, 'services', 'me', 'package.json'), 'utf-8')).version;

console.log(`🔄 Syncing version ${newVersion} across all services and libraries...`);

// Services to exclude from version sync
const EXCLUDED_SERVICES = ['app', 'wallet', 'website', 'zero', 'sync'];

// Helper to find all package.json files in a directory
function findPackageJsonFiles(dir, excludeList = []) {
	const files = [];
	try {
		const entries = readdirSync(dir);
		for (const entry of entries) {
			// Skip excluded services
			if (excludeList.includes(entry)) {
				continue;
			}
			const fullPath = join(dir, entry);
			const stat = statSync(fullPath);
			if (stat.isDirectory()) {
				const packageJsonPath = join(fullPath, 'package.json');
				try {
					statSync(packageJsonPath);
					files.push(packageJsonPath);
				} catch {
					// No package.json, continue
				}
			}
		}
	} catch (error) {
		// Directory doesn't exist, skip
	}
	return files;
}

// 1. Update all services/*/package.json (excluding app, wallet, website, zero, sync)
const servicesDir = join(rootDir, 'services');
const servicePackages = findPackageJsonFiles(servicesDir, EXCLUDED_SERVICES);
for (const packagePath of servicePackages) {
	const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
	packageJson.version = newVersion;
	writeFileSync(packagePath, JSON.stringify(packageJson, null, '\t') + '\n');
	console.log(`✅ Updated ${packagePath.replace(rootDir + '/', '')}`);
}

// 2. Update all libs/*/package.json
const libsDir = join(rootDir, 'libs');
const libPackages = findPackageJsonFiles(libsDir);
for (const packagePath of libPackages) {
	const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
	packageJson.version = newVersion;
	writeFileSync(packagePath, JSON.stringify(packageJson, null, '\t') + '\n');
	console.log(`✅ Updated ${packagePath.replace(rootDir + '/', '')}`);
}

// Note: Tauri/platform-specific files (Cargo.toml, tauri.conf.json, iOS Info.plist, project.yml)
// are NOT synced as the app service is kept for reference only

console.log(`\n✨ Version ${newVersion} synced successfully across all services and libraries!`);

