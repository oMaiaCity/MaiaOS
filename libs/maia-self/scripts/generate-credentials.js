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
// sync uses compact env vars (ACCOUNT_MODE, AGENT_ID, AGENT_SECRET, AGENT_STORAGE)
const SERVICE_PREFIXES = {
  'sync': 'AGENT', // compact output
  'city': 'CITY',
  'maia-city': 'CITY',
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
  process.exit(1);
}

const isSync = service.toLowerCase() === 'sync';

async function main() {
  try {
    const log = (...args) => console.error(...args);
    log('🔑 Generating agent credentials...\n');
    
    const { accountID, agentSecret } = await generateAgentCredentials({ name });
    const defaultMode = service === 'city' ? 'human' : 'agent';
    const defaultStorage = isSync ? 'pglite' : (service === 'city' ? 'indexeddb' : 'in-memory');
    
    const envContent = isSync
      ? `# Sync Service (compact env vars)
# Generated: ${new Date().toISOString()}
ACCOUNT_MODE=${defaultMode}
AGENT_ID=${accountID}
AGENT_SECRET=${agentSecret}
AGENT_STORAGE=${defaultStorage}
`
      : `# ${SERVICE_PREFIXES[service.toLowerCase()] || service} Service Configuration
# Generated: ${new Date().toISOString()}
${SERVICE_PREFIXES[service.toLowerCase()]}_MAIA_MODE=${defaultMode}
${SERVICE_PREFIXES[service.toLowerCase()]}_MAIA_AGENT_ACCOUNT_ID=${accountID}
${SERVICE_PREFIXES[service.toLowerCase()]}_MAIA_AGENT_SECRET=${agentSecret}
${SERVICE_PREFIXES[service.toLowerCase()]}_MAIA_STORAGE=${defaultStorage}
`;
    
    log('✅ Credentials generated successfully!\n');
    
    if (shouldWrite) {
      log('📋 Writing credentials to .env file...\n');
      const envPath = join(rootDir, '.env');
      let existingContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
      
      const removePatterns = isSync
        ? (s) => /^(ACCOUNT_MODE|AGENT_ID|AGENT_SECRET|AGENT_STORAGE)=/.test(s) || s.startsWith('SYNC_MAIA_') || s.startsWith('AGENT_MAIA_') || (s.startsWith('#') && (s.includes('Sync Service') || s.includes('SYNC Service') || s.includes('AGENT Service') || s.includes('Generated:')))
        : (s) => s.startsWith(`${SERVICE_PREFIXES[service.toLowerCase()]}_MAIA_`) || (s.startsWith('#') && (s.includes(SERVICE_PREFIXES[service.toLowerCase()]) || s.includes('Generated:')));
      
      const lines = existingContent.split('\n').filter(line => !removePatterns(line.trim()));
      existingContent = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      
      const newContent = existingContent ? `${existingContent}\n\n${envContent}` : envContent;
      writeFileSync(envPath, newContent, 'utf-8');
      log(`✅ Credentials written to .env file: ${envPath}\n`);
      log('📋 Generated credentials:\n');
      log(envContent);
    } else {
      log('📋 Generated credentials (not written):\n');
      log(envContent);
    }
    
    log('📝 Next steps:');
    log(`   1. Sync service uses: ACCOUNT_MODE, AGENT_ID, AGENT_SECRET, AGENT_STORAGE`);
    
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
