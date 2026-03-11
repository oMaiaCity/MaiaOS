#!/usr/bin/env bun

/**
 * Generate Agent Credentials for MaiaOS
 *
 * Output: AVEN_MAIA_ACCOUNT, AVEN_MAIA_SECRET, VITE_AVEN_TEST_MODE, VITE_AVEN_TEST_ACCOUNT, VITE_AVEN_TEST_SECRET
 * (No AVEN_TEST_ACCOUNT/AVEN_TEST_SECRET - client uses VITE_ prefixed vars only)
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
		const { accountID: testAccountID, agentSecret: testAgentSecret } = await generateAgentCredentials(
			{ name: 'Aven Test' },
		)

		if (!shouldWrite) {
			console.log(`# AVENS
AVEN_MAIA_ACCOUNT=${accountID}
AVEN_MAIA_SECRET=${agentSecret}
AVEN_MAIA_GUARDIAN=${testAccountID}

VITE_AVEN_TEST_MODE=true
VITE_AVEN_TEST_ACCOUNT=${testAccountID}
VITE_AVEN_TEST_SECRET=${testAgentSecret}
`)
			return
		}

		log('📋 Writing credentials to .env file...\n')
		const envPath = join(rootDir, '.env')
		let content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : ''

		// Replace existing credentials in place (preserves .env layout)
		const hasAccount = /^AVEN_MAIA_ACCOUNT=/m.test(content)
		const hasSecret = /^AVEN_MAIA_SECRET=/m.test(content)
		const hasViteTestMode = /^VITE_AVEN_TEST_MODE=/m.test(content)
		const hasViteTestAccount = /^VITE_AVEN_TEST_ACCOUNT=/m.test(content)
		const hasViteTestSecret = /^VITE_AVEN_TEST_SECRET=/m.test(content)
		const hasGuardian = /^AVEN_MAIA_GUARDIAN=/m.test(content)

		if (hasAccount) {
			content = content.replace(/^AVEN_MAIA_ACCOUNT=.*/m, `AVEN_MAIA_ACCOUNT=${accountID}`)
		}
		if (hasSecret) {
			content = content.replace(/^AVEN_MAIA_SECRET=.*/m, `AVEN_MAIA_SECRET=${agentSecret}`)
		}
		if (hasViteTestMode) {
			content = content.replace(/^VITE_AVEN_TEST_MODE=.*/m, 'VITE_AVEN_TEST_MODE=true')
		}
		if (hasViteTestAccount) {
			content = content.replace(
				/^VITE_AVEN_TEST_ACCOUNT=.*/m,
				`VITE_AVEN_TEST_ACCOUNT=${testAccountID}`,
			)
		}
		if (hasViteTestSecret) {
			content = content.replace(
				/^VITE_AVEN_TEST_SECRET=.*/m,
				`VITE_AVEN_TEST_SECRET=${testAgentSecret}`,
			)
		}
		if (hasGuardian) {
			content = content.replace(/^AVEN_MAIA_GUARDIAN=.*/m, `AVEN_MAIA_GUARDIAN=${testAccountID}`)
		}

		// If section missing, add # AVENS block
		if (!hasAccount || !hasSecret) {
			const avensBlock = `# AVENS
AVEN_MAIA_ACCOUNT=${accountID}
AVEN_MAIA_SECRET=${agentSecret}
AVEN_MAIA_GUARDIAN=${testAccountID}

VITE_AVEN_TEST_MODE=true
VITE_AVEN_TEST_ACCOUNT=${testAccountID}
VITE_AVEN_TEST_SECRET=${testAgentSecret}

`
			const hasAvensSection = /^# AVENS$/m.test(content)
			if (content.includes('# SYNC SERVICE') && !hasAvensSection) {
				content = content.replace(/(# SYNC SERVICE\n(?:[^\n#]*\n)*)/, `$1\n${avensBlock}`)
			} else if (!content.includes('AVEN_MAIA_ACCOUNT')) {
				content = content ? `${avensBlock}${content}` : avensBlock.trim()
			}
		}

		// Add AVEN_MAIA_GUARDIAN if missing (set to VITE_AVEN_TEST_ACCOUNT)
		if (!hasGuardian && content.includes('AVEN_MAIA_SECRET')) {
			content = content.replace(/(AVEN_MAIA_SECRET=.*\n)/, `$1AVEN_MAIA_GUARDIAN=${testAccountID}\n`)
		}

		// Add VITE_AVEN_TEST_* if missing (client-only; no AVEN_TEST_*)
		const needsViteTestVars =
			(!hasViteTestMode || !hasViteTestAccount || !hasViteTestSecret) &&
			content.includes('AVEN_MAIA_ACCOUNT')
		if (needsViteTestVars && !content.includes('VITE_AVEN_TEST_SECRET')) {
			const viteTestBlock = `

VITE_AVEN_TEST_MODE=true
VITE_AVEN_TEST_ACCOUNT=${testAccountID}
VITE_AVEN_TEST_SECRET=${testAgentSecret}
`
			content = content.replace(
				/(AVEN_MAIA_GUARDIAN=.*\n)/,
				`AVEN_MAIA_GUARDIAN=${testAccountID}\n${viteTestBlock}`,
			)
		}

		// Ensure one blank line between avens (Maia block vs VITE test block)
		content = content.replace(/(AVEN_MAIA_GUARDIAN=.*)\n(?!\n)(VITE_AVEN_TEST_MODE=)/m, '$1\n\n$2')

		// Migrate ## AVEN SERVICE → # AVENS; normalize section header
		content = content.replace(/^## AVEN SERVICE$/m, '# AVENS')
		content = content.replace(/^##AVENS$/m, '# AVENS')
		content = content.replace(/^## AVENS$/m, '# AVENS')

		// Remove duplicate/orphan # AVENS (empty section before APP SERVICE)
		content = content.replace(/\n# AVENS\s*\n(?=# APP SERVICE)/, '\n')

		// Remove legacy vars if present (one-time cleanup)
		content = content
			.replace(/^PEER_MODE=.*\n?/gm, '')
			.replace(/^PEER_ID=.*\n?/gm, '')
			.replace(/^PEER_SECRET=.*\n?/gm, '')
			.replace(/^PEER_STORAGE=.*\n?/gm, '')
			.replace(/^AVEN_TEST_MODE=.*\n?/gm, '') // Redundant - use VITE_AVEN_TEST_MODE
			.replace(/\n{3,}/g, '\n\n')
			.trim()

		writeFileSync(envPath, `${content}\n`, 'utf-8')
		log(`✅ Credentials written to ${envPath}\n`)
		log(
			'🔒 Keep AVEN_MAIA_SECRET and VITE_AVEN_TEST_SECRET secure. Never commit to version control.\n',
		)
	} catch (_error) {
		process.exit(1)
	}
}

main()
