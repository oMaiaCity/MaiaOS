#!/usr/bin/env bun

/**
 * Generate Agent Credentials for MaiaOS
 *
 * Output: PEER_MODE, PEER_ID, PEER_SECRET, PEER_STORAGE
 *
 * Modes:
 *   sync  - Moai/sync server (hosts /sync). Never connects to another. Default.
 *   agent - Client agent (connects to sync at PEER_MOAI). For future pure agent workers.
 *   human - Browser passkeys (maia). Uses VITE_PEER_MOAI.
 *
 * Usage:
 *   bun agent:generate
 *   bun agent:generate --mode=agent  # For agent workers that connect to sync
 *   bun agent:generate --no-write
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cojsonInternals } from 'cojson'
import { WasmCrypto } from 'cojson/crypto/WasmCrypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '../../..')

const { accountHeaderForInitialAgentSecret, idforHeader } = cojsonInternals

async function generateAgentCredentials({ name = 'Maia Agent' } = {}) {
	const crypto = await WasmCrypto.create()
	const agentSecret = crypto.newRandomAgentSecret()
	const accountHeader = accountHeaderForInitialAgentSecret(agentSecret, crypto)
	const accountID = idforHeader(accountHeader, crypto)
	return { accountID, agentSecret, name }
}

const args = process.argv.slice(2)
const nameArg = args.find((arg) => arg.startsWith('--name='))
const name = nameArg ? nameArg.split('=')[1] : 'Maia Agent'
const modeArg = args.find((arg) => arg.startsWith('--mode='))
const accountMode = modeArg ? modeArg.split('=')[1] : 'sync'
const shouldWrite = !args.includes('--no-write')

async function main() {
	try {
		const log = (..._a) => {}
		log('🔑 Generating agent credentials...\n')

		const { accountID, agentSecret } = await generateAgentCredentials({ name })
		const envContent = `# ${accountMode === 'sync' ? 'Sync (moai)' : accountMode === 'agent' ? 'Agent (client)' : 'Human'} Configuration
# Generated: ${new Date().toISOString()}
PEER_MODE=${accountMode}
PEER_ID=${accountID}
PEER_SECRET=${agentSecret}
PEER_STORAGE=pglite
${accountMode === 'agent' ? '# PEER_MOAI=localhost:4201  # Set to sync server URL' : ''}
`

		log('✅ Credentials generated successfully!\n')

		if (!shouldWrite) {
			console.log(envContent.trim())
		} else if (shouldWrite) {
			log('📋 Writing credentials to .env file...\n')
			const envPath = join(rootDir, '.env')
			let existingContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : ''

			const removePatterns = (s) =>
				/^(PEER_MODE|PEER_ID|PEER_SECRET|PEER_STORAGE)=/.test(s) ||
				(s.startsWith('#') &&
					(s.includes('PEER_MOAI=') ||
						s.includes('Sync') ||
						s.includes('Agent') ||
						s.includes('Human') ||
						s.includes('Generated:')))

			const lines = existingContent.split('\n').filter((line) => !removePatterns(line.trim()))
			existingContent = lines
				.join('\n')
				.replace(/\n{3,}/g, '\n\n')
				.trim()

			const newContent = existingContent ? `${existingContent}\n\n${envContent}` : envContent
			writeFileSync(envPath, newContent, 'utf-8')
			log(`✅ Credentials written to ${envPath}\n`)
		}

		log('📋 Generated credentials:\n')
		log(envContent)
		log('🔒 Keep PEER_SECRET secure. Never commit to version control.\n')
	} catch (_error) {
		process.exit(1)
	}
}

main()
