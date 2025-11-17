#!/usr/bin/env node
/**
 * Manually trigger a major version release via semantic-release
 * This bypasses commit analysis and forces a major version bump
 * 
 * Usage: bun run release:major
 *        bun run release:major 1.0.0  (specific version)
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Get current version
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

// Calculate next major version
const nextMajor = process.argv[2] || `${major + 1}.0.0`;

console.log(`🚀 Preparing major version release: ${currentVersion} → ${nextMajor}`);

// Step 1: Sync version across all files
console.log('\n📦 Syncing version across all files...');
execSync(`bun run version:sync ${nextMajor}`, { stdio: 'inherit' });

// Step 2: Commit the version change
console.log('\n📝 Committing version change...');
try {
  execSync(`git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json`, { stdio: 'inherit' });
  execSync(`git commit -m "chore(release): ${nextMajor}"`, { stdio: 'inherit' });
} catch (error) {
  console.log('⚠️  No changes to commit or commit failed');
}

// Step 3: Create git tag
console.log(`\n🏷️  Creating tag v${nextMajor}...`);
try {
  execSync(`git tag -a v${nextMajor} -m "Release ${nextMajor}"`, { stdio: 'inherit' });
} catch (error) {
  console.log('⚠️  Tag might already exist');
}

// Step 4: Note about semantic-release
console.log('\n✨ Version synced and committed!');
console.log('\n📋 Next steps:');
console.log('1. Push the commit: git push');
console.log('2. Run semantic-release: bun run release');
console.log('   (semantic-release will create tag, GitHub release, and CHANGELOG automatically)');
console.log('\nNote: Git tags are automatically created and pushed by semantic-release - no need to push tags manually!');

console.log(`\n✅ Major version release ${nextMajor} completed!`);

