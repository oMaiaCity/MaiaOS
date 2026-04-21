/**
 * Unified Sync Service - WebSocket sync + Agent API + LLM proxy
 *
 * Consolidates: sync (WebSocket), bootstrap + agent (/bootstrap, /register), api (/api/v0/llm/chat)
 *
 * Port: 4201
 *
 * Env vars (required - sync never generates credentials, only reads from env):
 *   AVEN_MAIA_ACCOUNT, AVEN_MAIA_SECRET - From Fly secrets (sync from .env: bun run agent:generate)
 *   PEER_SYNC_STORAGE=pglite | postgres (required - server never runs without persistent storage)
 *     - pglite: PEER_DB_PATH (default ./pg-lite.db)
 *     - postgres: PEER_SYNC_DB_URL (required)
 *   AVEN_MAIA_GUARDIAN: Human account co-id (co_z...). If set, add as admin of °maia spark guardian; also seeds /sync/write so that account can sync without POST /register.
 *   PEER_SYNC_SEED: unset/false vs true — **only** gate for genesis (missing scaffold fails fast until true). Optional re-genesis when already scaffolded (then unset after one-shot).
 *     Local dev + pglite + no BUCKET_NAME: clears PGlite data dir + local binary-bucket; new Aven Tester is written to repo .env after startup succeeds (avoids mid-boot .env watcher restarts). Production/postgres/Tigris: never auto-clears or auto-rotates; manual only.
 *   SEED_VIBES: Default "all". Which vibes to seed (todos, chat, addressbook, quickjs/Vibe Creator, etc). "all" seeds every vibe including quickjs.
 *   PEER_APP_HOST: Allowed CORS origin (e.g. https://next.maia.city). Required when NODE_ENV=production. Unset in dev with PGlite or MAIA_DEV_CORS=1: localhost:4200 only (no wildcard).
 *   MAIA_DEV_CORS=1: With Postgres local dev, enable same multi-origin dev CORS as PGlite (localhost / 127.0.0.1 / ::1 on port 4200).
 *   Read-only storage inspector (when sync is up): same paths; Bearer UCAN cmd `/admin/storage` + Capability grant (or `/admin`). BEGIN READ ONLY for POST /query.
 */

import {
	accountHasCapabilityOnPeer,
	ensureCoValueLoaded,
	ensureIdentity,
	findFirst,
	getCoListId,
} from '@MaiaOS/db'
import {
	bootstrapGuardianSteps,
	bootstrapIdentitySteps,
	createFlowContext,
	identitySelfAvenStep,
	runSteps,
	syncServerInfraSteps,
} from '@MaiaOS/flows'
import { bootstrapNodeLogging, createOpsLogger, OPS_PREFIX } from '@MaiaOS/logs'
import { agentIDToDidKey, verifyInvocationToken } from '@MaiaOS/maia-ucan'
import {
	createWebSocketPeer,
	DataEngine,
	ensureProfileForNewAccount,
	generateRegistryName,
	loadOrCreateAgentAccount,
	MaiaDB,
	MaiaScriptEvaluator,
	waitForStoreReady,
} from '@MaiaOS/runtime'
import {
	applyTesterCredentialsToEnvFile,
	generateAgentCredentials,
} from '@MaiaOS/self/generate-credentials'
import {
	STORAGE_INSPECTOR_DEFAULT_TABLE_PAGE,
	STORAGE_INSPECTOR_MAX_TABLE_PAGE,
} from '@MaiaOS/storage'
import { createHash } from 'node:crypto'
import { dirname, resolve as pathResolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clientIp } from './client-ip.js'
import { parseBootstrapBody } from './signup-helpers.js'

bootstrapNodeLogging()

// Resolve db path relative to sync package root (not process.cwd) so persistence is stable across restarts
const _syncDir = pathResolve(dirname(fileURLToPath(import.meta.url)), '..')

const opsSync = createOpsLogger('sync')
const opsRegister = createOpsLogger('register')
const opsLlm = createOpsLogger('llm')

const PORT = process.env.PORT || 4201
const PEER_DB_PATH = process.env.PEER_DB_PATH || './pg-lite.db'

const accountID = process.env.AVEN_MAIA_ACCOUNT
const agentSecret = process.env.AVEN_MAIA_SECRET
const storageType = process.env.PEER_SYNC_STORAGE || 'pglite'
if (storageType === 'in-memory' || storageType === 'jazz-cloud') {
	throw new Error(
		`${OPS_PREFIX.sync} Server requires persistent storage. Use PEER_SYNC_STORAGE=pglite or PEER_SYNC_STORAGE=postgres. No in-memory or jazz-cloud.`,
	)
}
const usePGlite = storageType === 'pglite'
const usePostgres = storageType === 'postgres'
if (!usePGlite && !usePostgres) {
	throw new Error(
		`${OPS_PREFIX.sync} PEER_SYNC_STORAGE must be pglite or postgres. Got: ${storageType}`,
	)
}
// Resolve relative to sync package dir (stable across runs regardless of cwd)
const dbPath = usePGlite ? pathResolve(_syncDir, PEER_DB_PATH) : undefined
const RED_PILL_API_KEY = process.env.RED_PILL_API_KEY || ''

let avenMaiaGuardian = process.env.AVEN_MAIA_GUARDIAN?.trim() || null

const peerSyncSeed = (process.env.PEER_SYNC_SEED ?? '').trim().toLowerCase() === 'true'

const isProduction = process.env.NODE_ENV === 'production'

const repoRoot = pathResolve(_syncDir, '../..')
const shouldAutoWipeLocalFiles =
	peerSyncSeed && !isProduction && usePGlite && !(process.env.BUCKET_NAME ?? '').trim()
if (isProduction && !process.env.PEER_APP_HOST?.trim()) {
	throw new Error(
		`${OPS_PREFIX.sync} PEER_APP_HOST is required in production (allowed browser origin, e.g. https://next.maia.city)`,
	)
}

// SEED_VIBES: which vibes to seed on genesis. Default "all" (includes quickjs / Vibe Creator). Override: "todos,chat" or "todos,chat,addressbook,quickjs"
const seedVibesConfig = process.env.SEED_VIBES || 'all'

/** CORS: PEER_APP_HOST = allowed origin (e.g. https://next.maia.city or localhost:4200). No wildcard. */
function normalizeCorsOrigin(host) {
	const trimmed = host?.trim() ?? ''
	if (!trimmed) return ''
	if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
		// Bare host (e.g. next.maia.city): browsers use https:// in production; http:// would never match Origin.
		return isProduction ? `https://${trimmed}` : `http://${trimmed}`
	}
	return trimmed
}

const DEV_APP_ORIGINS = new Set([
	'http://localhost:4200',
	'http://127.0.0.1:4200',
	'http://[::1]:4200',
])

const IS_LOCAL_DEV_CORS =
	usePGlite || process.env.MAIA_DEV_CORS === 'true' || process.env.MAIA_DEV_CORS === '1'

const rawPeerAppHost = process.env.PEER_APP_HOST?.trim() || ''
const CONFIGURED_CORS_ORIGIN = rawPeerAppHost ? normalizeCorsOrigin(rawPeerAppHost) : ''

/** Per-request CORS: no wildcard. With PEER_APP_HOST set, prod/dev match that origin; without it, localhost:4200 only (PGlite or MAIA_DEV_CORS). */
function corsHeadersForRequest(req) {
	const base = {
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	}
	const origin = req?.headers?.get?.('Origin') ?? null

	if (!CONFIGURED_CORS_ORIGIN) {
		if (!IS_LOCAL_DEV_CORS) {
			if (origin && DEV_APP_ORIGINS.has(origin)) {
				return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
			}
			if (!origin) {
				return { ...base, 'Access-Control-Allow-Origin': 'http://localhost:4200', Vary: 'Origin' }
			}
			opsSync.warn('CORS: origin not allowed (set PEER_APP_HOST or MAIA_DEV_CORS=1)', origin)
			return { ...base, Vary: 'Origin' }
		}
		if (origin && DEV_APP_ORIGINS.has(origin)) {
			return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
		}
		if (!origin) {
			return { ...base, 'Access-Control-Allow-Origin': 'http://localhost:4200', Vary: 'Origin' }
		}
		opsSync.warn('CORS: origin not allowed (dev, no PEER_APP_HOST)', origin)
		return { ...base, Vary: 'Origin' }
	}

	if (IS_LOCAL_DEV_CORS) {
		if (origin && (DEV_APP_ORIGINS.has(origin) || origin === CONFIGURED_CORS_ORIGIN)) {
			return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
		}
		if (!origin) {
			return { ...base, 'Access-Control-Allow-Origin': CONFIGURED_CORS_ORIGIN, Vary: 'Origin' }
		}
		opsSync.warn('CORS: origin not allowed (dev)', origin)
		return { ...base, Vary: 'Origin' }
	}
	if (!origin) {
		return { ...base, 'Access-Control-Allow-Origin': CONFIGURED_CORS_ORIGIN, Vary: 'Origin' }
	}
	if (origin === CONFIGURED_CORS_ORIGIN) {
		return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
	}
	opsSync.warn('CORS: origin not allowed', origin)
	return { ...base, Vary: 'Origin' }
}

let localNode = null
let agentWorker = null
let syncHandler = null
/** Read-only SQL inspector (PGlite / Postgres); set after LocalNode + MaiaDB boot. Always mounted when storage is ready. */
let storageInspector = null
/** Sessions we allowed through when unresolved (first message). Next message we'll check. */
const sessionsAllowedUnresolved = new Set()

function jsonResponse(data, status = 200, headers = {}, req) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
			...headers,
			...corsHeadersForRequest(req),
		},
	})
}

function err(msg, status = 400, extra = {}, req) {
	return jsonResponse({ ok: false, error: msg, ...extra }, status, {}, req)
}

/** Default 10 req/min/IP; override per path. OPTIONS exempt. */
const RL_DEFAULT = 10
const RL_OVERRIDES = new Map([
	['/health', Number.POSITIVE_INFINITY],
	['/bootstrap', 30],
	['/api/v0/llm/chat', 60],
	['/extend-capability', 20],
	['/register', 30],
])

const RL_BUCKETS = new Map()

function takeRateLimit(key, limit, windowMs = 60_000) {
	const now = Date.now()
	let b = RL_BUCKETS.get(key)
	if (!b || now - b.start >= windowMs) {
		b = { start: now, count: 1 }
		RL_BUCKETS.set(key, b)
		return { ok: true, reset: now + windowMs }
	}
	if (b.count >= limit) {
		return { ok: false, reset: b.start + windowMs }
	}
	b.count += 1
	return { ok: true, reset: b.start + windowMs }
}

function rateLimitFor(req, url) {
	if (req.method === 'OPTIONS') return { ok: true, reset: 0 }
	const limit = RL_OVERRIDES.get(url.pathname) ?? RL_DEFAULT
	if (!Number.isFinite(limit) || limit === Number.POSITIVE_INFINITY) {
		return { ok: true, reset: 0 }
	}
	const ip = clientIp(req)
	return takeRateLimit(`${url.pathname}:${ip}`, limit)
}

function auditRegisterDecision(req, data) {
	const ipHash = createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 12)
	opsRegister.log('decision', { route: '/register', ip_hash: ipHash, ...data })
}

/** Genesis seeds 265+ CoValues on cold Neon; 25s/load was marginal. 90s per-load is steady-state fine. */
const LOAD_TIMEOUT_MS = 90_000
const REQUEST_TIMEOUT_MS = 35000

function withTimeout(promise, ms, label) {
	return Promise.race([
		promise,
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
		),
	])
}

const STORAGE_INSPECTOR_BASE = '/api/v0/admin/storage'

/**
 * @param {Request} req
 * @param {URL} url
 * @param {object} worker - agent worker (peer + account for capability checks)
 * @returns {Promise<Response | null>}
 */
async function handleStorageInspectorHttp(req, url, worker) {
	if (!worker) return jsonResponse({ error: 'Initializing', status: 503 }, 503, {}, req)
	if (!storageInspector) {
		return jsonResponse({ error: 'Initializing', status: 503 }, 503, {}, req)
	}

	const auth = req.headers.get('Authorization')
	const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
	if (!token) {
		return jsonResponse({ error: 'Unauthorized', message: 'Bearer token required' }, 401, {}, req)
	}
	let payload
	try {
		payload = verifyInvocationToken(token, {
			now: Math.floor(Date.now() / 1000),
			allowedCmd: '/admin/storage',
		})
	} catch {
		return jsonResponse({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401, {}, req)
	}
	const accountId = payload?.accountId
	if (!accountId?.startsWith('co_z')) {
		return jsonResponse({ error: 'Forbidden', message: 'Invalid token claims' }, 403, {}, req)
	}
	const bindingOk = await verifyAccountBinding(worker.peer, accountId, payload.iss)
	if (!bindingOk) {
		return jsonResponse(
			{ error: 'Forbidden', message: 'Account binding verification failed' },
			403,
			{},
			req,
		)
	}
	const hasCap = await hasValidCapability(worker, accountId, '/admin/storage')
	if (!hasCap) {
		return jsonResponse(
			{
				error: 'Forbidden',
				message:
					'No valid /admin/storage capability. Ask a guardian to grant you access in Capabilities.',
			},
			403,
			{},
			req,
		)
	}

	const pathname = url.pathname

	if (pathname === `${STORAGE_INSPECTOR_BASE}/tables` && req.method === 'GET') {
		let limit = Number(url.searchParams.get('limit'))
		let offset = Number(url.searchParams.get('offset'))
		if (Number.isNaN(limit) || limit < 1) limit = STORAGE_INSPECTOR_DEFAULT_TABLE_PAGE
		if (limit > STORAGE_INSPECTOR_MAX_TABLE_PAGE) limit = STORAGE_INSPECTOR_MAX_TABLE_PAGE
		if (Number.isNaN(offset) || offset < 0) offset = 0
		const res = await storageInspector.listTables({ limit, offset })
		return jsonResponse({ ok: true, ...res }, 200, {}, req)
	}

	const prefix = `${STORAGE_INSPECTOR_BASE}/tables/`
	const suffix = '/columns'
	if (pathname.startsWith(prefix) && pathname.endsWith(suffix) && req.method === 'GET') {
		const enc = pathname.slice(prefix.length, -suffix.length)
		const name = decodeURIComponent(enc)
		try {
			const res = await storageInspector.describeTable(name)
			return jsonResponse({ ok: true, ...res }, 200, {}, req)
		} catch (e) {
			return jsonResponse({ ok: false, error: e?.message || String(e) }, 400, {}, req)
		}
	}

	if (pathname === `${STORAGE_INSPECTOR_BASE}/query` && req.method === 'POST') {
		let body
		try {
			body = await req.json()
		} catch {
			return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400, {}, req)
		}
		const sql = body?.sql
		const params = body?.params
		if (typeof sql !== 'string') {
			return jsonResponse({ ok: false, error: 'sql string required' }, 400, {}, req)
		}
		try {
			const res = await storageInspector.query(sql, Array.isArray(params) ? params : [])
			return jsonResponse({ ok: true, ...res }, 200, {}, req)
		} catch (e) {
			return jsonResponse({ ok: false, error: e?.message || String(e) }, 400, {}, req)
		}
	}

	return null
}

function getSparksRegistryCoId(account) {
	const id = account.get('sparks')
	if (!id?.startsWith('co_z'))
		throw new Error(
			'account.sparks not found. Run sync once with PEER_SYNC_SEED=true to create genesis scaffold, then unset.',
		)
	return id
}

async function loadCoMap(peer, coId, opts = {}) {
	const { timeout = LOAD_TIMEOUT_MS, retries = 1 } = opts
	let lastErr
	for (let i = 1; i <= retries; i++) {
		try {
			const store = await peer.read(null, coId)
			await withTimeout(waitForStoreReady(store, coId, timeout), timeout, `load(${coId.slice(0, 12)})`)
			const core = peer.node.getCoValue(coId)
			if (core && peer.isAvailable(core)) return peer.getCurrentContent(core)
			lastErr = new Error(`CoMap ${coId.slice(0, 12)}... not available`)
		} catch (e) {
			lastErr = e
			if (i < retries) await new Promise((r) => setTimeout(r, 500))
		}
	}
	throw lastErr
}

/** Verify that the signer (iss/did:key) owns the claimed accountID. Prevents forged accountID in token. */
async function verifyAccountBinding(peer, accountId, expectedDidKey) {
	if (!accountId?.startsWith('co_z') || !expectedDidKey?.startsWith('did:key:')) return false
	try {
		const store = await peer.read(null, accountId)
		await withTimeout(waitForStoreReady(store, accountId, 5000), 5000, 'verifyAccountBinding')
		const core = peer.node.getCoValue(accountId)
		if (!core || !peer.isAvailable(core)) return false
		const agentId = core.verified?.header?.ruleset?.initialAdmin
		if (!agentId || typeof agentId !== 'string') return false
		const derivedDidKey = agentIDToDidKey(agentId)
		return derivedDidKey === expectedDidKey
	} catch {
		return false
	}
}

/** Check if account has valid capability from Capability index CoList. /admin grants all. */
async function hasValidCapability(worker, accountId, cmd) {
	const peer = worker.peer
	if (!peer.infra?.capability) {
		await worker.dataEngine.resolveSystemFactories()
	}
	return accountHasCapabilityOnPeer(peer, worker.account, accountId, cmd)
}

/** Extract account/agent ID from CoJSON sessionID (format: id_session_z... or id_session_d...). */
function accountOrAgentIDfromSessionID(sessionID) {
	if (!sessionID || typeof sessionID !== 'string') return null
	const idx = sessionID.indexOf('_session')
	return idx >= 0 ? sessionID.slice(0, idx) : null
}

/** Check if id is account (co_z...) vs agent (sealer_z...). */
function isAccountID(id) {
	return id != null && typeof id === 'string' && id.startsWith('co_')
}

/** Agent IDs match if equal or if one is the sealer prefix of the other (sealer_z... vs sealer_z.../signer_z...). */
function agentIdsMatch(a, b) {
	if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false
	if (a === b) return true
	return a.startsWith(`${b}/`) || b.startsWith(`${a}/`)
}

/** Resolve agentId (sealer_z...) to accountId by finding account whose initialAdmin matches. */
async function resolveAgentIdToAccountId(worker, agentId) {
	if (!agentId?.startsWith('sealer_')) return null
	try {
		// Resolve server's agent to its account (AVEN_MAIA_ACCOUNT has /admin capability)
		const serverAccountId = worker.account?.id ?? worker.account?.$jazz?.id ?? accountID
		if (serverAccountId?.startsWith('co_z')) {
			const node = worker.peer?.node
			if (node && typeof node.getCurrentAccountOrAgentID === 'function') {
				const serverAgentId = node.getCurrentAccountOrAgentID()
				if (agentIdsMatch(serverAgentId, agentId)) return serverAccountId
			}
			try {
				const store = await worker.peer.read(null, serverAccountId)
				await withTimeout(waitForStoreReady(store, serverAccountId, 5000), 5000, 'resolveServerAccount')
				const core = worker.peer.node.getCoValue(serverAccountId)
				if (core && worker.peer.isAvailable(core)) {
					const initialAdmin = core.verified?.header?.ruleset?.initialAdmin
					if (agentIdsMatch(initialAdmin, agentId)) return serverAccountId
				}
			} catch (_e) {}
		}
		const sparksId = getSparksRegistryCoId(worker.account)
		if (sparksId?.startsWith('co_z')) {
			const sparksRaw = await worker.peer.getRawRecord(sparksId)
			if (sparksRaw && typeof sparksRaw === 'object') {
				for (const sparkCoId of Object.values(sparksRaw)) {
					if (typeof sparkCoId !== 'string' || !sparkCoId.startsWith('co_z')) continue
					try {
						const sparkContent = await loadCoMap(worker.peer, sparkCoId, { retries: 1 })
						const groupId = sparkContent?.get?.('group')
						if (!groupId?.startsWith('co_z')) continue
						const core = worker.peer.node.getCoValue(groupId)
						if (!core || !worker.peer.isAvailable(core)) continue
						const initialAdmin = core.verified?.header?.ruleset?.initialAdmin
						if (agentIdsMatch(initialAdmin, agentId)) return groupId
					} catch (_e) {}
				}
			}
		}
		if (worker.dataEngine?.resolveSystemFactories) {
			await worker.dataEngine.resolveSystemFactories()
		}
		const identitySchemaCoId = worker.peer.infra?.identity
		if (identitySchemaCoId?.startsWith('co_z')) {
			const coListId = await getCoListId(worker.peer, identitySchemaCoId)
			if (coListId?.startsWith('co_z')) {
				await ensureCoValueLoaded(worker.peer, coListId, {
					waitForAvailable: true,
					timeoutMs: 8000,
				})
				const listCore = worker.peer.node.getCoValue(coListId)
				if (listCore && worker.peer.isAvailable(listCore)) {
					const content = worker.peer.getCurrentContent(listCore)
					const itemIds = content?.toJSON?.() ?? []
					for (const identId of itemIds) {
						if (typeof identId !== 'string' || !identId.startsWith('co_z')) continue
						await ensureCoValueLoaded(worker.peer, identId, {
							waitForAvailable: true,
							timeoutMs: 5000,
						})
						const idCore = worker.peer.node.getCoValue(identId)
						if (!idCore || !worker.peer.isAvailable(idCore)) continue
						const cmap = worker.peer.getCurrentContent(idCore)
						const accId = cmap?.get?.('account')
						if (!accId?.startsWith('co_z')) continue
						const accCore = worker.peer.node.getCoValue(accId)
						if (!accCore || !worker.peer.isAvailable(accCore)) continue
						const initialAdmin = accCore.verified?.header?.ruleset?.initialAdmin
						if (agentIdsMatch(initialAdmin, agentId)) return accId
					}
				}
			}
		}
		return null
	} catch {
		return null
	}
}

/** Check sync write capability for all sessions in msg. Reject if any writer lacks /sync/write. */
async function checkSyncWriteCapability(worker, msg) {
	const newSessions = msg?.new
	if (!newSessions || typeof newSessions !== 'object' || Object.keys(newSessions).length === 0) {
		return { ok: true }
	}
	for (const sessionID of Object.keys(newSessions)) {
		const id = accountOrAgentIDfromSessionID(sessionID)
		if (!id) continue
		let accountId = id
		if (!isAccountID(id)) {
			accountId = await resolveAgentIdToAccountId(worker, id)
			if (!accountId) {
				if (sessionsAllowedUnresolved.has(sessionID)) {
					return {
						ok: false,
						error: `Agent ${id.slice(0, 16)}... not in registry. Register to enable writes.`,
					}
				}
				sessionsAllowedUnresolved.add(sessionID)
				continue
			}
			sessionsAllowedUnresolved.delete(sessionID)
		}
		const hasCap = await hasValidCapability(worker, accountId, '/sync/write')
		if (!hasCap) {
			return {
				ok: false,
				error: `Account ${accountId.slice(0, 12)}... lacks /sync/write capability. Ask a guardian to approve in Capabilities (Members).`,
			}
		}
	}
	return { ok: true }
}

/**
 * POST /bootstrap — unified one-shot handshake for new/returning humans.
 *
 * Responsibilities (all atomic from the client's perspective):
 *   1. Return the server's sparks registry co-id so the client can anchor account.sparks (trusting).
 *   2. If accountId is AVEN_MAIA_GUARDIAN: promote to °maia spark admin (idempotent) + seed capabilities.
 *   3. Ensure an identity CoMap exists in the identity index for this account (type='human').
 *
 * maiaSparkCoId intentionally NOT returned: it is already set inside the sparks CoMap at genesis,
 * and the client reads it directly via MaiaDB.resolveSystemSparkCoId.
 */
async function handleBootstrap(worker, body, req) {
	const parsed = parseBootstrapBody(body)
	if (!parsed.ok) {
		return err(
			`${parsed.field} required (co_z…)`,
			400,
			{ validationErrors: [{ field: parsed.field }] },
			req,
		)
	}
	const { accountId, profileId } = parsed
	try {
		const sparksId = getSparksRegistryCoId(worker.account)

		const _mnRaw = process.env.AVEN_MAIA_NAME || 'Maia'
		const _mn = _mnRaw.startsWith('Aven ') ? _mnRaw : `Aven ${_mnRaw}`
		const flowCtx = createFlowContext({
			worker,
			log: opsSync,
			env: {
				serverAccountId: accountID,
				guardianAccountId: avenMaiaGuardian,
				maiaName: _mn,
				seedVibes: seedVibesConfig,
			},
			allowApply: peerSyncSeed,
			bootstrap: { accountId, profileId },
		})

		try {
			await runSteps(
				flowCtx,
				bootstrapGuardianSteps({
					guardianAccountId: avenMaiaGuardian,
					bootstrapAccountId: accountId,
				}),
			)
		} catch (e) {
			opsSync.warn('handleBootstrap: guardian flow:', e?.message ?? e)
		}
		try {
			await runSteps(flowCtx, bootstrapIdentitySteps())
		} catch (e) {
			opsSync.warn('handleBootstrap: identity flow:', e?.message ?? e)
		}

		return jsonResponse({ sparks: sparksId }, 200, {}, req)
	} catch (e) {
		return err(e?.message ?? 'bootstrap failed', 500, {}, req)
	}
}

// --- Agent handlers ---
/**
 * POST /register — server self-registration only.
 *
 * Used for:
 *   - type='aven': the Maia server registers its own account at startup.
 *   - type='spark': sparks created server-side (e.g. during genesis seed).
 *
 * Human identities are registered via POST /bootstrap (see handleBootstrap).
 */
async function handleRegister(worker, body, req) {
	const { type, username, accountId, profileId, sparkCoId } = body || {}
	if (type !== 'spark' && type !== 'aven')
		return err(
			'type required: spark or aven',
			400,
			{ validationErrors: [{ field: 'type', message: 'must be spark or aven' }] },
			req,
		)
	if (type === 'aven' && (!accountId || typeof accountId !== 'string'))
		return err(
			'accountId required for type=aven',
			400,
			{ validationErrors: [{ field: 'accountId', message: 'required' }] },
			req,
		)
	if (
		type === 'aven' &&
		(!profileId || typeof profileId !== 'string' || !profileId.startsWith('co_z'))
	)
		return err(
			'profileId required for type=aven',
			400,
			{ validationErrors: [{ field: 'profileId', message: 'required (co_z...)' }] },
			req,
		)
	if (type === 'spark' && (!sparkCoId || typeof sparkCoId !== 'string'))
		return err(
			'sparkCoId required for type=spark',
			400,
			{ validationErrors: [{ field: 'sparkCoId', message: 'required' }] },
			req,
		)

	const coId = type === 'spark' ? sparkCoId : accountId
	let u =
		username != null && typeof username === 'string' && username.trim() ? username.trim() : null

	const { peer, dataEngine } = worker
	try {
		if (type === 'aven') {
			await dataEngine.resolveSystemFactories()
			const identitySchemaCoId = peer.infra?.identity
			if (!identitySchemaCoId)
				return err(
					'Identity schema not found. Ensure sync ran genesis (PEER_SYNC_SEED=true once).',
					500,
					{},
					req,
				)
			const existingRow = await findFirst(peer, identitySchemaCoId, {
				account: accountId,
				type,
			})
			if (existingRow?.id?.startsWith('co_z')) {
				return jsonResponse(
					{
						ok: true,
						type,
						username: u ?? generateRegistryName(type),
						accountId: coId,
						identityCoMapId: existingRow.id,
						alreadyRegistered: true,
					},
					200,
					{},
					req,
				)
			}
			if (!u) u = generateRegistryName(type)
			const result = await ensureIdentity({ peer, dataEngine, type, accountId, profileId })
			return jsonResponse(
				{ ok: true, type, username: u, accountId: coId, identityCoMapId: result.identityCoMapId },
				200,
				{},
				req,
			)
		}

		const registryId = getSparksRegistryCoId(worker.account)
		const raw = await peer.getRawRecord(registryId)

		if (!u) u = generateRegistryName(type)
		if (raw?.[u] != null && raw[u] !== coId)
			return err(`username "${u}" already registered to different identity`, 409, {}, req)
		const r = await dataEngine.execute({ op: 'update', id: registryId, data: { [u]: coId } })
		if (r?.ok === false)
			return err(r.errors?.map((e) => e.message).join('; ') ?? 'update failed', 500, {}, req)
		return jsonResponse({ ok: true, type, username: u, sparkCoId: coId }, 200, {}, req)
	} catch (e) {
		auditRegisterDecision(req, {
			ok: false,
			status: 500,
			error: e?.message ?? 'failed to register',
		})
		return err(e?.message ?? 'failed to register', 500, {}, req)
	}
}

/** Extend a capability by 1 day. Server-side write (avoids chicken-and-egg: client needs /sync/write to sync). */
async function handleExtendCapability(worker, body, req) {
	const { capabilityId } = body || {}
	if (!capabilityId || typeof capabilityId !== 'string' || !capabilityId.startsWith('co_z'))
		return err('capabilityId required (co_z...)', 400, {}, req)

	const auth = body._authHeader
	const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
	if (!token) return err('Authorization: Bearer token required', 401, {}, req)

	let payload
	try {
		payload = verifyInvocationToken(token, {
			now: Math.floor(Date.now() / 1000),
			allowedCmd: null, // Any valid token
		})
	} catch {
		return err('Invalid or expired token', 401, {}, req)
	}
	const callerAccountId = payload?.accountId
	if (!callerAccountId?.startsWith('co_z')) return err('Invalid token claims', 403, {}, req)

	const bindingOk = await verifyAccountBinding(worker.peer, callerAccountId, payload.iss)
	if (!bindingOk) return err('Account binding verification failed', 403, {}, req)

	try {
		const capContent = await loadCoMap(worker.peer, capabilityId, { retries: 2 })
		const sub = capContent?.get?.('sub')
		const currentExp = capContent?.get?.('exp')
		if (!sub?.startsWith('co_z')) return err('Invalid capability (no sub)', 400, {}, req)

		const isOwner = callerAccountId === sub
		const isGuardian = avenMaiaGuardian?.startsWith('co_z') && callerAccountId === avenMaiaGuardian
		if (!isOwner && !isGuardian)
			return err('Forbidden: only capability owner or guardian can extend', 403, {}, req)

		const now = Math.floor(Date.now() / 1000)
		const oneDay = 86400
		const newExp = Math.max(now, typeof currentExp === 'number' ? currentExp : 0) + oneDay

		const r = await worker.dataEngine.execute({
			op: 'update',
			id: capabilityId,
			data: { exp: newExp },
		})
		if (r?.ok === false)
			return err(r.errors?.map((e) => e.message).join('; ') ?? 'update failed', 500, {}, req)
		const ipHash = createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 12)
		opsRegister.log('decision', {
			route: '/extend-capability',
			ok: true,
			status: 200,
			ip_hash: ipHash,
			capabilityId_prefix: capabilityId?.slice(0, 12) ?? null,
		})
		return jsonResponse({ ok: true, newExp }, 200, {}, req)
	} catch (e) {
		return err(e?.message ?? 'failed to extend capability', 500, {}, req)
	}
}

async function handleAgentHttp(req, worker) {
	const url = new URL(req.url)
	const post = async (strict, handler) => {
		try {
			const body = strict ? await req.json() : await req.json().catch(() => ({}))
			return await handler(worker, body, req)
		} catch (e) {
			return err(e.message, e?.message?.includes('timed out') ? 504 : 400, {}, req)
		}
	}
	if (url.pathname === '/register' && req.method === 'POST')
		return post(false, (w, b, r) =>
			withTimeout(handleRegister(w, b, r), REQUEST_TIMEOUT_MS, '/register'),
		)
	if (url.pathname === '/bootstrap' && req.method === 'POST')
		return post(false, (w, b, r) =>
			withTimeout(handleBootstrap(w, b, r), REQUEST_TIMEOUT_MS, '/bootstrap'),
		)
	if (url.pathname === '/extend-capability' && req.method === 'POST') {
		const auth = req.headers.get('Authorization')
		return post(false, (w, b, r) =>
			withTimeout(
				handleExtendCapability(w, { ...b, _authHeader: auth }, r),
				REQUEST_TIMEOUT_MS,
				'/extend-capability',
			),
		)
	}
	return null
}

/** LLM messages schema: role + optional content. Enforces structure and limits. */
const LLM_MAX_MESSAGES = 100
const LLM_MAX_CONTENT_LENGTH = 200_000
const LLM_ALLOWED_ROLES = new Set(['system', 'user', 'assistant'])

function validateLLMMessages(messages) {
	if (!messages || !Array.isArray(messages) || messages.length === 0) {
		return { ok: false, error: 'messages array required' }
	}
	if (messages.length > LLM_MAX_MESSAGES) {
		return { ok: false, error: `messages array exceeds max ${LLM_MAX_MESSAGES}` }
	}
	for (let i = 0; i < messages.length; i++) {
		const m = messages[i]
		if (!m || typeof m !== 'object' || Array.isArray(m)) {
			return { ok: false, error: `messages[${i}] must be object` }
		}
		if (!m.role || typeof m.role !== 'string' || !LLM_ALLOWED_ROLES.has(m.role)) {
			return { ok: false, error: `messages[${i}].role must be system, user, or assistant` }
		}
		if ('content' in m && m.content != null) {
			if (typeof m.content !== 'string') {
				return { ok: false, error: `messages[${i}].content must be string` }
			}
			if (m.content.length > LLM_MAX_CONTENT_LENGTH) {
				return {
					ok: false,
					error: `messages[${i}].content exceeds max ${LLM_MAX_CONTENT_LENGTH} chars`,
				}
			}
		}
	}
	return { ok: true }
}

/** LLM proxy: forwards request to RedPill, returns response. Tool execution is client-side (Runtime). Requires Bearer token + valid /llm/chat capability. */
async function handleLLMChat(req, worker) {
	if (!RED_PILL_API_KEY)
		return jsonResponse({ error: 'RED_PILL_API_KEY not configured' }, 500, {}, req)
	if (!worker) return jsonResponse({ error: 'Initializing', status: 503 }, 503, {}, req)

	// Auth gate: Bearer token + account binding + capability
	const auth = req.headers.get('Authorization')
	const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
	if (!token) {
		return jsonResponse({ error: 'Unauthorized', message: 'Bearer token required' }, 401, {}, req)
	}
	let payload
	try {
		payload = verifyInvocationToken(token, {
			now: Math.floor(Date.now() / 1000),
			allowedCmd: '/llm/chat',
		})
	} catch {
		return jsonResponse({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401, {}, req)
	}
	const accountId = payload?.accountId
	if (!accountId?.startsWith('co_z')) {
		return jsonResponse({ error: 'Forbidden', message: 'Invalid token claims' }, 403, {}, req)
	}
	const bindingOk = await verifyAccountBinding(worker.peer, accountId, payload.iss)
	if (!bindingOk) {
		opsLlm.warn('Account binding failed', { accountId: accountId?.slice(0, 12) })
		return jsonResponse(
			{ error: 'Forbidden', message: 'Account binding verification failed' },
			403,
			{},
			req,
		)
	}
	const hasCap = await hasValidCapability(worker, accountId, '/llm/chat')
	if (!hasCap) {
		opsLlm.warn('No valid capability', { accountId: accountId?.slice(0, 12) })
		return jsonResponse(
			{
				error: 'Forbidden',
				message: 'No valid /llm/chat capability. Ask a guardian to grant you access in Capabilities.',
			},
			403,
			{},
			req,
		)
	}

	try {
		const body = await req.json()
		const { messages, model = 'qwen/qwen3-30b-a3b-instruct-2507', temperature = 1, tools } = body
		const validation = validateLLMMessages(messages)
		if (!validation.ok) return jsonResponse({ error: validation.error }, 400, {}, req)

		const reqBody = {
			model,
			messages,
			temperature,
			...(Array.isArray(tools) && tools.length > 0 && { tools }),
		}
		const res = await fetch('https://api.redpill.ai/v1/chat/completions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RED_PILL_API_KEY}` },
			body: JSON.stringify(reqBody),
		})
		const txt = await res.text()
		if (!res.ok) {
			let data = { error: 'LLM request failed' }
			try {
				data = JSON.parse(txt)
			} catch {}
			opsLlm.error('RedPill upstream error', res.status, data.error || txt.slice(0, 200))
			return jsonResponse(
				{ error: data.error || `HTTP ${res.status}`, message: data.message || txt.slice(0, 200) },
				500,
				{},
				req,
			)
		}
		const data = JSON.parse(txt)
		return jsonResponse(data, 200, {}, req)
	} catch (e) {
		const msg = e?.message ?? String(e)
		opsLlm.error('handleLLMChat catch', msg, e)
		return jsonResponse({ error: 'Failed to process LLM request', message: msg }, 500, {}, req)
	}
}

function handleCORS(req) {
	return new Response(null, {
		status: 204,
		headers: corsHeadersForRequest(req),
	})
}

// --- WebSocket (sync) ---
function adaptBunWebSocket(ws, _clientId) {
	const messageListeners = []
	const openListeners = []
	const adaptedWs = {
		...ws,
		addEventListener(type, listener) {
			if (type === 'message') messageListeners.push(listener)
			else if (type === 'open') openListeners.push(listener)
		},
		removeEventListener() {},
		send: (data) => ws.send(data),
		close: (code, reason) => ws.close(code, reason),
		get readyState() {
			return ws.readyState
		},
	}
	ws._messageListeners = messageListeners
	ws._adaptedWs = adaptedWs
	return { adaptedWs, messageListeners, openListeners }
}

/** Bun passes `string | Buffer` (and sometimes views); cojson-transport-ws requires a string for deserializeMessages. */
function wsMessageToUtf8String(msg) {
	if (typeof msg === 'string') return msg
	return Buffer.from(msg).toString('utf8')
}

function startPing(ws) {
	const send = () => {
		if (ws.readyState === WebSocket.OPEN) {
			try {
				ws.send(JSON.stringify({ type: 'ping', time: Date.now(), dc: 'unknown' }))
			} catch (_e) {
				clearInterval(iv)
			}
		} else clearInterval(iv)
	}
	const iv = setInterval(send, 1500)
	send()
	return iv
}

Bun.serve({
	hostname: '0.0.0.0',
	port: PORT,
	async fetch(req, srv) {
		try {
			if (req.method === 'OPTIONS') return handleCORS(req)

			const url = new URL(req.url)
			const rl = rateLimitFor(req, url)
			if (!rl.ok) {
				const retryAfter = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))
				return new Response(JSON.stringify({ ok: false, error: 'Too many requests' }), {
					status: 429,
					headers: {
						'Content-Type': 'application/json',
						'Retry-After': String(retryAfter),
						...corsHeadersForRequest(req),
					},
				})
			}

			if (url.pathname === '/health') {
				return jsonResponse({ status: 'ok', service: 'sync', ready: !!syncHandler }, 200, {}, req)
			}

			if (url.pathname === '/sync') {
				if (!syncHandler) return jsonResponse({ error: 'Initializing', status: 503 }, 503, {}, req)
				const wsCors = corsHeadersForRequest(req)
				if (req.headers.get('upgrade') !== 'websocket')
					return new Response('Expected WebSocket upgrade', {
						status: 426,
						headers: wsCors,
					})
				const ok = srv.upgrade(req, { data: {}, headers: wsCors })
				return ok
					? undefined
					: new Response('Failed to upgrade', {
							status: 500,
							headers: wsCors,
						})
			}

			// Agent routes (require agentWorker)
			if (agentWorker) {
				const agentRes = await handleAgentHttp(req, agentWorker)
				if (agentRes) return agentRes
			} else if (url.pathname.startsWith('/register') || url.pathname.startsWith('/bootstrap')) {
				return jsonResponse({ error: 'Initializing', status: 503 }, 503, {}, req)
			}

			// API (LLM)
			if (url.pathname === '/api/v0/llm/chat' && req.method === 'POST') {
				if (!agentWorker) return jsonResponse({ error: 'Initializing', status: 503 }, 503, {}, req)
				return handleLLMChat(req, agentWorker)
			}

			if (url.pathname.startsWith(STORAGE_INSPECTOR_BASE)) {
				const res = await handleStorageInspectorHttp(req, url, agentWorker)
				if (res) return res
			}

			return new Response('Not Found', { status: 404, headers: corsHeadersForRequest(req) })
		} catch (e) {
			opsSync.error('fetch:', e?.message ?? e, e?.stack)
			return jsonResponse({ ok: false, error: 'Internal server error' }, 500, {}, req)
		}
	},
	websocket: {
		async open(ws) {
			try {
				if (syncHandler) await syncHandler.open(ws)
				else ws.close(1008, 'Sync initializing')
			} catch (e) {
				opsSync.error('websocket open:', e?.message ?? e)
				try {
					ws.close(1011, 'Internal error')
				} catch (_closeErr) {}
			}
		},
		async message(ws, msg) {
			try {
				if (!syncHandler) return
				await syncHandler.message(ws, wsMessageToUtf8String(msg))
			} catch (e) {
				opsSync.error('websocket message:', e?.message ?? e)
			}
		},
		async close(ws, code, reason) {
			try {
				syncHandler?.close(ws, code, reason)
			} catch (e) {
				opsSync.error('websocket close:', e?.message ?? e)
			}
		},
		error(_ws, _err) {},
	},
})

opsSync.log('Listening on 0.0.0.0:%s', PORT)

;(async () => {
	/** Set when local PEER_SYNC_SEED wipe runs; `.env` is updated at Ready via {@link applyTesterCredentialsToEnvFile}. */
	let pendingApplyTesterEnv = null
	try {
		if (!accountID || !agentSecret) {
			throw new Error('AVEN_MAIA_ACCOUNT and AVEN_MAIA_SECRET required. Run: bun agent:generate')
		}

		if (dbPath && !process.env.PEER_DB_PATH) process.env.PEER_DB_PATH = dbPath

		if (shouldAutoWipeLocalFiles && dbPath) {
			const { accountID: testAccountID, agentSecret: testAgentSecret } =
				await generateAgentCredentials({
					name: 'Secret key dev',
				})
			pendingApplyTesterEnv = { testAccountID, testAgentSecret }
			process.env.AVEN_MAIA_GUARDIAN = testAccountID
			process.env.VITE_AVEN_TEST_ACCOUNT = testAccountID
			process.env.VITE_AVEN_TEST_SECRET = testAgentSecret
			process.env.VITE_AVEN_TEST_MODE = 'true'
			avenMaiaGuardian = testAccountID

			const blobPathResolved = pathResolve(_syncDir, process.env.PEER_BLOB_PATH || './binary-bucket')
			process.env.PEER_BLOB_PATH = blobPathResolved

			const { clearLocalPgliteAndFsBlob } = await import('@MaiaOS/storage/clearLocalPgliteAndFsBlob')
			await clearLocalPgliteAndFsBlob({ dbPath, blobPath: blobPathResolved })
			opsSync.log(
				'PEER_SYNC_SEED: removed + recreated PGlite data dir and cleared local binary-bucket chunks (tester credentials saved to .env after Ready)',
			)
			opsSync.log('PEER_SYNC_SEED paths: PGlite data dir=%s blob root=%s', dbPath, blobPathResolved)
		} else if (peerSyncSeed && !shouldAutoWipeLocalFiles) {
			const reasons = []
			if (isProduction) reasons.push('NODE_ENV=production')
			if (!usePGlite) reasons.push(`PEER_SYNC_STORAGE=${storageType} (not pglite)`)
			if ((process.env.BUCKET_NAME ?? '').trim())
				reasons.push('BUCKET_NAME is set (remote blob store)')
			opsSync.log(
				'PEER_SYNC_SEED=true but local FS auto-wipe skipped: %s',
				reasons.length ? reasons.join('; ') : 'unknown',
			)
		}

		const storageLabel = usePostgres ? 'Postgres' : `PGlite at ${dbPath || './pg-lite.db'}`
		opsSync.log('Loading account (%s)...', storageLabel)
		opsSync.log('accountID=%s', `${accountID?.slice(0, 12)}...`)
		if (!RED_PILL_API_KEY) {
			opsSync.warn(
				'RED_PILL_API_KEY not set — LLM chat will return 500. Add to root .env and restart.',
			)
		}

		const maiaNameRaw = process.env.AVEN_MAIA_NAME || 'Maia'
		const maiaName = maiaNameRaw.startsWith('Aven ') ? maiaNameRaw : `Aven ${maiaNameRaw}`
		const result = await loadOrCreateAgentAccount({
			accountID,
			agentSecret,
			syncDomain: null,
			dbPath,
			createName: maiaName,
		})

		localNode = result.node
		localNode.enableGarbageCollector()

		// Ensure profile name matches env var on every startup
		try {
			const profileId = result.account.get('profile')
			if (profileId) {
				const profileCore = localNode.getCoValue(profileId)
				if (profileCore?.isAvailable()) {
					const profile = profileCore.getCurrentContent()
					if (profile?.get('name') !== maiaName) {
						profile.set('name', maiaName)
					}
				}
			}
		} catch (_e) {}

		// Graceful shutdown: flush pending storage writes before exit (ensures scaffold persists)
		const shutdown = async () => {
			try {
				if (localNode?.syncManager?.gracefulShutdown) {
					await localNode.syncManager.gracefulShutdown()
				}
			} catch (e) {
				opsSync.error('Graceful shutdown error:', e?.message ?? e)
			}
			process.exit(0)
		}
		process.on('SIGTERM', () => shutdown())
		process.on('SIGINT', () => shutdown())

		const peer = new MaiaDB(
			{ node: localNode, account: result.account },
			{
				beforeAcceptWrite: async (_p, msg, from) => {
					if (!agentWorker) return { ok: true }
					if (from === 'storage' || from === 'import' || typeof from === 'string') return { ok: true }
					return checkSyncWriteCapability(agentWorker, msg)
				},
			},
		)
		storageInspector = localNode.storage.dbClient.inspector()
		const evaluator = new MaiaScriptEvaluator()
		const dataEngine = new DataEngine(peer, { evaluator })
		peer.dbEngine = dataEngine
		agentWorker = { node: localNode, account: result.account, peer, dataEngine }

		// Ensure migration completes before seed (sparkGuardian -> guardian)
		// loadAccount defers migration; seed needs guardian in os.groups
		await ensureProfileForNewAccount(result.account, localNode)

		const flowCtx = createFlowContext({
			worker: agentWorker,
			log: opsSync,
			env: {
				serverAccountId: accountID,
				guardianAccountId: avenMaiaGuardian,
				maiaName,
				seedVibes: seedVibesConfig,
			},
			allowApply: peerSyncSeed,
		})
		await runSteps(flowCtx, syncServerInfraSteps)
		await runSteps(flowCtx, [identitySelfAvenStep()]).catch((e) =>
			opsSync.warn('Self-register aven:', e?.message),
		)

		syncHandler = {
			async open(ws) {
				const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
				const {
					adaptedWs,
					messageListeners: _messageListeners,
					openListeners,
				} = adaptBunWebSocket(ws, clientId)
				const peer = createWebSocketPeer({
					id: clientId,
					role: 'client',
					websocket: adaptedWs,
					expectPings: false,
					batchingByDefault: false,
					deletePeerStateOnClose: true,
					onSuccess: () => {},
					onClose: () => {
						if (ws.data?.pingInterval) clearInterval(ws.data.pingInterval)
					},
				})
				localNode.syncManager.addPeer(peer)
				ws.data = { clientId, peer, pingInterval: startPing(ws) }
				queueMicrotask(() => {
					for (const l of openListeners)
						try {
							l({ type: 'open', target: adaptedWs })
						} catch (_e) {}
				})
			},
			async message(ws, msg) {
				for (const l of ws._messageListeners || [])
					try {
						l({ type: 'message', data: msg, target: ws._adaptedWs })
					} catch (_e) {}
			},
			async close(ws, _code, _reason) {
				if (ws.data?.pingInterval) clearInterval(ws.data.pingInterval)
				if (ws.data?.peer)
					try {
						localNode.syncManager.removePeer(ws.data.peer)
					} catch (_e) {}
			},
		}
		if (pendingApplyTesterEnv) {
			applyTesterCredentialsToEnvFile(repoRoot, pendingApplyTesterEnv)
			opsSync.log(
				'PEER_SYNC_SEED: persisted Aven Tester + guardian to repo .env — restart app dev server to pick up VITE_AVEN_*',
			)
		}
		opsSync.log('Ready')
	} catch (e) {
		opsSync.error('Init failed:', e?.message ?? e)
		if (e?.stack) opsSync.error('stack', e.stack)
		process.exit(1)
	}
})()
