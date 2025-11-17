#!/usr/bin/env node
/**
 * Centralized version sync script for monorepo
 * Syncs version across:
 * - All services package.json files
 * - All libs package.json files
 * - services/app/src-tauri/Cargo.toml
 * - services/app/src-tauri/tauri.conf.json
 * - services/app/src-tauri/gen/apple/app_iOS/Info.plist (iOS)
 * - services/app/src-tauri/gen/apple/project.yml (iOS)
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Get version from command line or from services/app/package.json (source of truth)
const newVersion = process.argv[2] || JSON.parse(readFileSync(join(rootDir, 'services', 'app', 'package.json'), 'utf-8')).version;

console.log(`🔄 Syncing version ${newVersion} across all services, libraries, and platforms...`);

// Helper to find all package.json files in a directory
function findPackageJsonFiles(dir) {
	const files = [];
	try {
		const entries = readdirSync(dir);
		for (const entry of entries) {
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

// 1. Update all services/*/package.json
const servicesDir = join(rootDir, 'services');
const servicePackages = findPackageJsonFiles(servicesDir);
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

// 3. Update Cargo.toml (only for app service)
const cargoTomlPath = join(rootDir, 'services', 'app', 'src-tauri', 'Cargo.toml');
try {
	let cargoToml = readFileSync(cargoTomlPath, 'utf-8');
	cargoToml = cargoToml.replace(/^version = ".*"$/m, `version = "${newVersion}"`);
	writeFileSync(cargoTomlPath, cargoToml);
	console.log('✅ Updated services/app/src-tauri/Cargo.toml');
} catch (error) {
	console.log('⚠️  Cargo.toml not found (skipping)');
}

// 4. Update tauri.conf.json (only for app service)
const tauriConfPath = join(rootDir, 'services', 'app', 'src-tauri', 'tauri.conf.json');
try {
	const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf-8'));
	tauriConf.version = newVersion;
	writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
	console.log('✅ Updated services/app/src-tauri/tauri.conf.json');
} catch (error) {
	console.log('⚠️  tauri.conf.json not found (skipping)');
}

// 5. Update iOS Info.plist (if exists)
const iosInfoPlistPath = join(rootDir, 'services', 'app', 'src-tauri', 'gen', 'apple', 'app_iOS', 'Info.plist');
try {
	let infoPlist = readFileSync(iosInfoPlistPath, 'utf-8');
	infoPlist = infoPlist.replace(
		/<key>CFBundleShortVersionString<\/key>\s*<string>.*<\/string>/,
		`<key>CFBundleShortVersionString</key>\n\t<string>${newVersion}</string>`
	);
	infoPlist = infoPlist.replace(
		/<key>CFBundleVersion<\/key>\s*<string>.*<\/string>/,
		`<key>CFBundleVersion</key>\n\t<string>${newVersion}</string>`
	);
	writeFileSync(iosInfoPlistPath, infoPlist);
	console.log('✅ Updated services/app/src-tauri/gen/apple/app_iOS/Info.plist');
} catch (error) {
	console.log('⚠️  iOS Info.plist not found (will be generated on build)');
}

// 6. Update iOS project.yml (if exists)
const projectYmlPath = join(rootDir, 'services', 'app', 'src-tauri', 'gen', 'apple', 'project.yml');
try {
	let projectYml = readFileSync(projectYmlPath, 'utf-8');
	projectYml = projectYml.replace(
		/CFBundleShortVersionString:\s*.*/g,
		`CFBundleShortVersionString: ${newVersion}`
	);
	projectYml = projectYml.replace(
		/CFBundleVersion:\s*".*"/g,
		`CFBundleVersion: "${newVersion}"`
	);
	writeFileSync(projectYmlPath, projectYml);
	console.log('✅ Updated services/app/src-tauri/gen/apple/project.yml');
} catch (error) {
	console.log('⚠️  iOS project.yml not found (will be generated on build)');
}

console.log(`\n✨ Version ${newVersion} synced successfully across all services, libraries, and platforms!`);

