#!/usr/bin/env bun
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
/**
 * Verify Fly build args for app (VITE_PEER_SYNC_HOST).
 * Note: VITE_PEER_SYNC_HOST is a build arg (fly.toml [build.args]), NOT a Fly secret.
 * Build args are inlined at Docker build time; secrets are runtime-only.
 *
 * Usage:
 *   bun scripts/fly-build-args-verify.js          # Verify fly.toml + echo values
 *   bun scripts/fly-build-args-verify.js --set    # Interactively confirm before deploy
 */
import { bootstrapNodeLogging, createLogger } from '../libs/maia-logs/src/index.js'

bootstrapNodeLogging()
const flyVerifyLog = createLogger('fly-verify')

const __dirname = dirname(fileURLToPath(import.meta.url))
const flyTomlPath = resolve(__dirname, '../services/app/fly.toml')

const EXPECTED_SYNC_HOST = 'sync.next.maia.city'

const content = readFileSync(flyTomlPath, 'utf-8')
const match = content.match(/VITE_PEER_SYNC_HOST\s*=\s*["']?([^"'\s]+)["']?/)
const current = match ? match[1] : null

flyVerifyLog.log('\n📦 App build args (fly.toml [build.args])')
flyVerifyLog.log(`   VITE_PEER_SYNC_HOST: ${current || '(not found)'}`)
flyVerifyLog.log(`   Expected: ${EXPECTED_SYNC_HOST}`)

if (current === EXPECTED_SYNC_HOST) {
	flyVerifyLog.log('   ✅ Correct - WebSocket will connect to wss://sync.next.maia.city/sync\n')
} else {
	flyVerifyLog.log('   ⚠️  Mismatch - fix fly.toml or deploy with:')
	flyVerifyLog.log(`      VITE_PEER_SYNC_HOST=${EXPECTED_SYNC_HOST} ./services/app/deploy.sh\n`)
	process.exit(1)
}
