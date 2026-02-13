#!/usr/bin/env bun
/**
 * Verify Fly build args for maia (VITE_PEER_MOAI).
 * Note: VITE_PEER_MOAI is a build arg (fly.toml [build.args]), NOT a Fly secret.
 * Build args are inlined at Docker build time; secrets are runtime-only.
 *
 * Usage:
 *   bun scripts/fly-build-args-verify.js          # Verify fly.toml + echo values
 *   bun scripts/fly-build-args-verify.js --set    # Interactively confirm before deploy
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const flyTomlPath = resolve(__dirname, '../services/maia/fly.toml')

const EXPECTED_MOAI = 'moai.next.maia.city'

const content = readFileSync(flyTomlPath, 'utf-8')
const match = content.match(/VITE_PEER_MOAI\s*=\s*["']?([^"'\s]+)["']?/)
const current = match ? match[1] : null

console.log('\n📦 Maia build args (fly.toml [build.args])')
console.log(`   VITE_PEER_MOAI: ${current || '(not found)'}`)
console.log(`   Expected: ${EXPECTED_MOAI}`)

if (current === EXPECTED_MOAI) {
	console.log('   ✅ Correct - WebSocket will connect to wss://moai.next.maia.city/sync\n')
} else {
	console.log('   ⚠️  Mismatch - fix fly.toml or deploy with:')
	console.log(`      VITE_PEER_MOAI=${EXPECTED_MOAI} ./services/maia/deploy.sh\n`)
	process.exit(1)
}
