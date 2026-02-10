#!/usr/bin/env bun

/**
 * Generate Agent Credentials for MaiaOS
 * 
 * Generates static credentials (accountID and agentSecret) for agent mode.
 * Similar to Jazz server workers: `npx jazz-run account create`
 * 
 * Usage:
 *   bun agent:generate --service=sync    # Generate credentials for sync service (SYNC_MAIA_*)
 *   bun agent:generate --service=city    # Generate credentials for maia-city service (CITY_MAIA_*)
 *   bun agent:generate --service=sync --name "My Sync Server"
 *   bun agent:generate --service=city --no-write  # Generate without writing to .env
 * 
 * Available services:
 *   sync      - Sync service (uses SYNC_MAIA_* env vars, defaults to agent mode with pglite storage)
 *   city      - Maia-city frontend (uses CITY_MAIA_* env vars, defaults to human mode with indexeddb storage)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { WasmCrypto } from 'cojson/crypto/WasmCrypto';
import { cojsonInternals } from 'cojson';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../../..'); // Go up from libs/maia-self/scripts/ to root

// Extract functions from cojsonInternals
const { accountHeaderForInitialAgentSecret, idforHeader } = cojsonInternals;

/**
 * Generate agent credentials (static credentials for server/edge runtimes)
 * Inline implementation matching libs/maia-self/src/self.js
 */
async function generateAgentCredentials({ name = "Maia Agent" } = {}) {
	const crypto = await WasmCrypto.create();
	
	// Generate random agentSecret (not derived from passkey)
	const agentSecret = crypto.newRandomAgentSecret();
	
	// Compute accountID deterministically from agentSecret (same pattern as passkey flow)
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto);
	const accountID = idforHeader(accountHeader, crypto);
	
	return {
		accountID,
		agentSecret,
		name
	};
}

const args = process.argv.slice(2);
const nameArg = args.find(arg => arg.startsWith('--name='));
const name = nameArg ? nameArg.split('=')[1] : 'Maia Agent';
const serviceArg = args.find(arg => arg.startsWith('--service='));
const service = serviceArg ? serviceArg.split('=')[1] : null; // 'sync', 'city', or null (will show error)
const shouldWrite = args.includes('--write') || !args.includes('--no-write'); // Write by default, use --no-write to skip

// Map service name to env var prefix
const SERVICE_PREFIXES = {
  'sync': 'SYNC',
  'city': 'CITY',
  'maia-city': 'CITY',
  'agent': 'AGENT'
};

// Require service to be specified
if (!service) {
  console.error('❌ Error: --service flag is required');
  console.error('');
  console.error('Usage:');
  console.error('  bun agent:generate --service=sync    # Generate credentials for sync service');
  console.error('  bun agent:generate --service=city    # Generate credentials for maia-city service');
  console.error('');
  console.error('Available services:');
  console.error('  sync      - Sync service (uses SYNC_MAIA_* env vars)');
  console.error('  city      - Maia-city frontend (uses CITY_MAIA_* env vars)');
  console.error('  agent     - Agent service (uses AGENT_MAIA_* env vars)');
  process.exit(1);
}

const servicePrefix = SERVICE_PREFIXES[service.toLowerCase()] || service.toUpperCase();

async function main() {
  try {
    // Output to stderr to avoid Bun's output filtering
    const log = (...args) => {
      console.error(...args);
    };
    
    log('🔑 Generating agent credentials...\n');
    
    // Generate credentials
    const { accountID, agentSecret, name: accountName } = await generateAgentCredentials({ name });
    
    // Format for .env file with service-specific prefix
    const prefix = `${servicePrefix}_`;
    const defaultMode = service === 'city' ? 'human' : 'agent'; // maia-city defaults to human mode
    const defaultStorage = service === 'sync' || service === 'agent' ? 'pglite' : (service === 'city' ? 'indexeddb' : 'in-memory');
    
    const envContent = `# ${servicePrefix} Service Configuration
# Generated: ${new Date().toISOString()}
${prefix}MAIA_MODE=${defaultMode}
${prefix}MAIA_AGENT_ACCOUNT_ID=${accountID}
${prefix}MAIA_AGENT_SECRET=${agentSecret}
${prefix}MAIA_STORAGE=${defaultStorage}
`;
    
    log('✅ Credentials generated successfully!\n');
    
    // Write to .env file by default (unless --no-write flag is used)
    if (shouldWrite) {
      log('📋 Writing credentials to .env file...\n');
      const envPath = join(rootDir, '.env');
      let existingContent = '';
      
      if (existsSync(envPath)) {
        existingContent = readFileSync(envPath, 'utf-8');
      }
      
      // Check if credentials already exist (service-specific)
      const accountIdKey = `${prefix}MAIA_AGENT_ACCOUNT_ID`;
      if (existingContent.includes(accountIdKey)) {
        console.log(`⚠️  Warning: ${servicePrefix} service credentials already exist in .env file.`);
        console.log('   Existing credentials will be replaced.\n');
        
        // Remove old service-specific credentials
        const lines = existingContent.split('\n');
        const filteredLines = lines.filter(line => {
          return !line.startsWith(`${prefix}MAIA_MODE=`) &&
                 !line.startsWith(`${prefix}MAIA_AGENT_ACCOUNT_ID=`) &&
                 !line.startsWith(`${prefix}MAIA_AGENT_SECRET=`) &&
                 !line.startsWith(`${prefix}MAIA_STORAGE=`) &&
                 !line.startsWith(`# ${servicePrefix} Service Configuration`) &&
                 !line.startsWith('# Generated:');
        });
        existingContent = filteredLines.join('\n').trim();
      }
      
      // Append new credentials
      const newContent = existingContent 
        ? `${existingContent}\n\n${envContent}`
        : envContent;
      
      writeFileSync(envPath, newContent, 'utf-8');
      log(`✅ Credentials written to .env file: ${envPath}\n`);
      log('📋 Generated credentials:\n');
      log(envContent);
    } else {
      log('📋 Generated credentials (not written to .env - use without --no-write to auto-write):\n');
      log(envContent);
    }
    
    log('📝 Next steps:');
    log(`   1. Credentials are now in your .env file with ${servicePrefix}_ prefix`);
    log(`   2. ${servicePrefix}_MAIA_MODE is set to ${defaultMode}`);
    log(`   3. ${servicePrefix}_MAIA_STORAGE is set to ${defaultStorage}`);
    log(`   4. The ${service} service will use these credentials automatically\n`);
    
    log('🔒 Security Note:');
    log('   - Keep MAIA_AGENT_SECRET secure (like a password)');
    log('   - Never commit agent secrets to version control');
    log('   - Use environment variables or secrets management in production\n');
    
  } catch (error) {
    console.error('❌ Error generating credentials:', error.message);
    process.exit(1);
  }
}

main();
