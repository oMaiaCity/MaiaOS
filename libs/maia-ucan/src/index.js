/**
 * maia-ucan — UCAN-like invocation tokens for MaiaOS
 * Creates and verifies signed tokens from agentSecret (passkey-derived)
 */
import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2.js'
import { didKeyToPublicKey, publicKeyToDidKey } from './did-key.js'

export { agentIDToDidKey } from './did-key.js'

import { getPublicKey, sign } from './sign.js'

/** @noble/ed25519 v3+: sync sign/verify need hashes.sha512 (v2 used ed.etc.sha512Sync). */
ed.hashes.sha512 = sha512
ed.hashes.sha512Async = (m) => Promise.resolve(sha512(m))

function base64urlEncode(bytes) {
	const b64 = btoa(String.fromCharCode(...bytes))
	return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(str) {
	const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
	const pad = (4 - (b64.length % 4)) % 4
	const padded = b64 + '='.repeat(pad)
	const binary = atob(padded)
	return new Uint8Array(binary.length).map((_, i) => binary.charCodeAt(i))
}

function canonicalize(payload) {
	const keys = Object.keys(payload).sort()
	const canon = {}
	for (const k of keys) canon[k] = payload[k]
	return JSON.stringify(canon)
}

/**
 * Create UCAN invocation token
 * @param {string} agentSecret
 * @param {string} accountID - co-id for maia/accountID in meta
 * @param {Object} opts
 * @param {string} opts.cmd - e.g. "/test-ucan"
 * @param {Object} [opts.args={}]
 * @param {number} [opts.exp] - Unix seconds (default: now+60)
 * @param {string} [opts.nonce] - 12 bytes base64url (generated if omitted)
 * @returns {string} JWT-style token
 */
export function createInvocationToken(agentSecret, accountID, opts = {}) {
	const { cmd, args = {}, exp, nonce: nonceOpt } = opts
	if (!cmd || typeof cmd !== 'string') throw new Error('cmd required')

	const now = Math.floor(Date.now() / 1000)
	const expVal = exp ?? now + 60
	const nonce = nonceOpt ?? base64urlEncode(crypto.getRandomValues(new Uint8Array(12)))

	const iss = publicKeyToDidKey(getPublicKey(agentSecret))
	const payload = {
		iss,
		sub: iss,
		cmd,
		args,
		prf: [],
		nonce,
		exp: expVal,
		meta: { 'maia/accountID': accountID },
	}

	const header = { alg: 'EdDSA', typ: 'ucan-invocation' }
	const headerB64 = base64urlEncode(new TextEncoder().encode(canonicalize(header)))
	const payloadB64 = base64urlEncode(new TextEncoder().encode(canonicalize(payload)))
	const message = `${headerB64}.${payloadB64}`
	const messageBytes = new TextEncoder().encode(message)
	const sigBytes = sign(agentSecret, messageBytes)
	const sigB64 = base64urlEncode(sigBytes)

	return `${message}.${sigB64}`
}

/**
 * Verify UCAN invocation token
 * @param {string} token - JWT-style string
 * @param {Object} opts
 * @param {number} [opts.now] - Unix seconds (default: Date.now()/1000)
 * @param {string|string[]} [opts.allowedCmd] - e.g. "/test-ucan" or ["/test-ucan"]
 * @returns {Object} { iss, sub, accountId }
 */
export function verifyInvocationToken(token, opts = {}) {
	if (!token || typeof token !== 'string') {
		throw new Error('Token required')
	}
	const parts = token.split('.')
	if (parts.length !== 3) throw new Error('Invalid token format')

	const [headerB64, payloadB64, sigB64] = parts
	const message = `${headerB64}.${payloadB64}`
	const messageBytes = new TextEncoder().encode(message)

	let payload
	try {
		const payloadJson = new TextDecoder().decode(base64urlDecode(payloadB64))
		payload = JSON.parse(payloadJson)
	} catch {
		throw new Error('Invalid token payload')
	}

	const now = opts.now ?? Math.floor(Date.now() / 1000)
	if (payload.exp != null && payload.exp < now) {
		throw new Error('Token expired')
	}

	const allowedCmd = opts.allowedCmd
	if (allowedCmd != null) {
		const allowed = Array.isArray(allowedCmd) ? allowedCmd : [allowedCmd]
		if (!allowed.includes(payload.cmd)) {
			throw new Error(`cmd ${payload.cmd} not allowed`)
		}
	}

	const iss = payload.iss
	if (!iss?.startsWith('did:key:')) throw new Error('Invalid iss')

	let pubkey
	try {
		pubkey = didKeyToPublicKey(iss)
	} catch {
		throw new Error('Invalid did:key in iss')
	}

	const sigBytes = base64urlDecode(sigB64)
	if (sigBytes.length !== 64) throw new Error('Invalid signature length')

	const valid = ed.verify(sigBytes, messageBytes, pubkey)
	if (!valid) throw new Error('Invalid signature')

	return {
		iss: payload.iss,
		sub: payload.sub,
		accountId: payload.meta?.['maia/accountID'] ?? null,
	}
}
