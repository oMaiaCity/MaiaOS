#!/usr/bin/env node
/**
 * Sync version across all platform files:
 * - package.json
 * - src-tauri/Cargo.toml
 * - src-tauri/tauri.conf.json
 * - src-tauri/gen/apple/app_iOS/Info.plist (iOS)
 * - src-tauri/gen/apple/project.yml (iOS)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Get version from command line or package.json
const newVersion = process.argv[2] || JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8')).version;

console.log(`🔄 Syncing version ${newVersion} across all platforms...`);

// 1. Update package.json
const packageJsonPath = join(rootDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
packageJson.version = newVersion;
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, '\t') + '\n');
console.log('✅ Updated package.json');

// 2. Update Cargo.toml
const cargoTomlPath = join(rootDir, 'src-tauri', 'Cargo.toml');
let cargoToml = readFileSync(cargoTomlPath, 'utf-8');
cargoToml = cargoToml.replace(/^version = ".*"$/m, `version = "${newVersion}"`);
writeFileSync(cargoTomlPath, cargoToml);
console.log('✅ Updated Cargo.toml');

// 3. Update tauri.conf.json
const tauriConfPath = join(rootDir, 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf-8'));
tauriConf.version = newVersion;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log('✅ Updated tauri.conf.json');

// 4. Update iOS Info.plist (if exists)
const iosInfoPlistPath = join(rootDir, 'src-tauri', 'gen', 'apple', 'app_iOS', 'Info.plist');
try {
  let infoPlist = readFileSync(iosInfoPlistPath, 'utf-8');
  // Update CFBundleShortVersionString
  infoPlist = infoPlist.replace(
    /<key>CFBundleShortVersionString<\/key>\s*<string>.*<\/string>/,
    `<key>CFBundleShortVersionString</key>\n\t<string>${newVersion}</string>`
  );
  // Update CFBundleVersion (use version as build number, or increment)
  infoPlist = infoPlist.replace(
    /<key>CFBundleVersion<\/key>\s*<string>.*<\/string>/,
    `<key>CFBundleVersion</key>\n\t<string>${newVersion}</string>`
  );
  writeFileSync(iosInfoPlistPath, infoPlist);
  console.log('✅ Updated iOS Info.plist');
} catch (error) {
  console.log('⚠️  iOS Info.plist not found (will be generated on build)');
}

// 5. Update iOS project.yml (if exists)
const projectYmlPath = join(rootDir, 'src-tauri', 'gen', 'apple', 'project.yml');
try {
  let projectYml = readFileSync(projectYmlPath, 'utf-8');
  // Update CFBundleShortVersionString
  projectYml = projectYml.replace(
    /CFBundleShortVersionString:\s*.*/g,
    `CFBundleShortVersionString: ${newVersion}`
  );
  // Update CFBundleVersion
  projectYml = projectYml.replace(
    /CFBundleVersion:\s*".*"/g,
    `CFBundleVersion: "${newVersion}"`
  );
  writeFileSync(projectYmlPath, projectYml);
  console.log('✅ Updated iOS project.yml');
} catch (error) {
  console.log('⚠️  iOS project.yml not found (will be generated on build)');
}

console.log(`\n✨ Version ${newVersion} synced successfully!`);

