#!/usr/bin/env bun

/**
 * Generate Agent Credentials for MaiaOS
 *
 * Output: AVEN_MAIA_ACCOUNT, AVEN_MAIA_SECRET (## AVEN SERVICE section)
 *
 * Modes:
 *   sync  - Sync server (hosts /sync). Never connects to another. Default.
 *   agent - Client agent (connects to sync at PEER_SYNC_HOST). For future pure agent workers.
 *   human - Browser passkeys (app). Uses VITE_PEER_SYNC_HOST.
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
const shouldWrite = !args.includes('--no-write')

async function main() {
	try {
		const log = (..._a) => {}
		log('🔑 Generating agent credentials...\n')

		const { accountID, agentSecret } = await generateAgentCredentials({ name })

		if (!shouldWrite) {
			console.log(`## AVEN SERVICE
AVEN_MAIA_ACCOUNT=${accountID}
AVEN_MAIA_SECRET=${agentSecret}
`)
			return
		}

		log('📋 Writing credentials to .env file...\n')
		const envPath = join(rootDir, '.env')
		let content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : ''

		// Replace existing credentials in place (preserves .env layout)
		const hasAccount = /^AVEN_MAIA_ACCOUNT=/m.test(content)
		const hasSecret = /^AVEN_MAIA_SECRET=/m.test(content)

		if (hasAccount) {
			content = content.replace(/^AVEN_MAIA_ACCOUNT=.*/m, `AVEN_MAIA_ACCOUNT=${accountID}`)
		}
		if (hasSecret) {
			content = content.replace(/^AVEN_MAIA_SECRET=.*/m, `AVEN_MAIA_SECRET=${agentSecret}`)
		}

		// If section missing, add ## AVEN SERVICE block (matches .env layout)
		if (!hasAccount || !hasSecret) {
			const avenServiceBlock = `## AVEN SERVICE
AVEN_MAIA_ACCOUNT=${accountID}
AVEN_MAIA_SECRET=${agentSecret}
AVEN_MAIA_GUARDIAN=

`
			const hasAvenServiceSection = /^## AVEN SERVICE$/m.test(content)
			if (content.includes('# SYNC SERVICE') && !hasAvenServiceSection) {
				content = content.replace(/(# SYNC SERVICE\n(?:[^\n#]*\n)*)/, `$1\n${avenServiceBlock}`)
			} else if (!content.includes('AVEN_MAIA_ACCOUNT')) {
				content = content ? `${avenServiceBlock}${content}` : avenServiceBlock.trim()
			}
		}

		// Remove legacy vars if present (one-time cleanup)
		content = content
			.replace(/^PEER_MODE=.*\n?/gm, '')
			.replace(/^PEER_ID=.*\n?/gm, '')
			.replace(/^PEER_SECRET=.*\n?/gm, '')
			.replace(/^PEER_STORAGE=.*\n?/gm, '')
			.replace(/\n{3,}/g, '\n\n')
			.trim()

		writeFileSync(envPath, `${content}\n`, 'utf-8')
		log(`✅ Credentials written to ${envPath}\n`)
		log('🔒 Keep AVEN_MAIA_SECRET secure. Never commit to version control.\n')
	} catch (_error) {
		process.exit(1)
	}
}

main()
