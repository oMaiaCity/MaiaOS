#!/usr/bin/env bun

/**
 * Free a port by killing the process listening on it.
 * Used by dev.js, dev-maia.js, dev-moai.js
 */

import { execSync } from 'node:child_process'

/**
 * @param {number} port
 * @param {(msg: string) => void} [log]
 * @returns {Promise<boolean>} true if port was freed or was free
 */
export async function freePort(port, log = () => {}) {
	try {
		const portCheck = execSync(`lsof -ti:${port} -sTCP:LISTEN 2>/dev/null | head -1`, {
			encoding: 'utf-8',
		}).trim()
		if (!portCheck) return true
		const processInfo = execSync(`ps -p ${portCheck} -o command= 2>/dev/null`, {
			encoding: 'utf-8',
		}).trim()
		log(`Port ${port} in use by: ${processInfo || 'unknown'}. Attempting to free...`)
		try {
			execSync(`kill ${portCheck} 2>/dev/null`, { timeout: 2000 })
			await new Promise((r) => setTimeout(r, 800))
		} catch (_e) {
			try {
				execSync(`kill -9 ${portCheck} 2>/dev/null`, { timeout: 2000 })
				await new Promise((r) => setTimeout(r, 800))
			} catch (_e2) {
				log(`Could not free port ${port}. Kill manually: kill ${portCheck}`)
				return false
			}
		}
		return true
	} catch (_e) {
		return true
	}
}
