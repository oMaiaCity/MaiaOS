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

import { accountHasCapabilityOnPeer, ensureCoValueLoaded, getCoListId } from '@MaiaOS/db'
import {
	createFlowContext,
	identitySelfAvenStep,
	runSteps,
	syncServerInfraSteps,
} from '@MaiaOS/flows'
import { bootstrapNodeLogging, createLogger, createOpsLogger, OPS_PREFIX } from '@MaiaOS/logs'
import { agentIDToDidKey } from '@MaiaOS/maia-ucan'
import {
	createWebSocketPeer,
	DataEngine,
	ensureProfileForNewAccount,
	loadOrCreateAgentAccount,
	MaiaDB,
	MaiaScriptEvaluator,
	waitForStoreReady,
} from '@MaiaOS/runtime'
import {
	applyTesterCredentialsToEnvFile,
	generateAgentCredentials,
} from '@MaiaOS/self/generate-credentials'
import { dirname, resolve as pathResolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHandleAgentHttp } from './handlers/agent-http.js'
import { handleLLMChat } from './handlers/llm-chat.js'
import {
	createHandleStorageInspectorHttp,
	STORAGE_INSPECTOR_BASE,
} from './handlers/storage-inspector.js'
import { corsHeadersForRequestFactory, normalizeCorsOrigin } from './http/cors.js'
import { rateLimitFor } from './http/rate-limit.js'
import { adaptBunWebSocket, startPing, wsMessageToUtf8String } from './http/ws-adapter.js'
import { parseBootstrapBody } from './signup-helpers.js'

bootstrapNodeLogging()

// Resolve db path relative to sync package root (not process.cwd) so persistence is stable across restarts
const _syncDir = pathResolve(dirname(fileURLToPath(import.meta.url)), '..')

const opsSync = createOpsLogger('sync')
/** Not OPS-gated: `scripts/dev.js` must observe Listening + Ready on stdout when `LOG_MODE` is empty. */
const syncDevLifecycleLog = createLogger('sync')
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

const IS_LOCAL_DEV_CORS =
	usePGlite || process.env.MAIA_DEV_CORS === 'true' || process.env.MAIA_DEV_CORS === '1'

const rawPeerAppHost = process.env.PEER_APP_HOST?.trim() || ''
const CONFIGURED_CORS_ORIGIN = rawPeerAppHost
	? normalizeCorsOrigin(rawPeerAppHost, isProduction)
	: ''

const corsHeadersForRequest = corsHeadersForRequestFactory(opsSync, {
	configuredCorsOrigin: CONFIGURED_CORS_ORIGIN,
	isLocalDevCors: IS_LOCAL_DEV_CORS,
})

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

/** Genesis seeds 265+ CoValues on cold Neon; 25s/load was marginal. 90s per-load is steady-state fine. */
const LOAD_TIMEOUT_MS = 90_000

function withTimeout(promise, ms, label) {
	return Promise.race([
		promise,
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
		),
	])
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

const handleStorageInspectorHttp = createHandleStorageInspectorHttp({
	jsonResponse,
	getStorageInspector: () => storageInspector,
	verifyAccountBinding,
	hasValidCapability,
})

const handleAgentHttp = createHandleAgentHttp({
	err,
	register: {
		err,
		jsonResponse,
		getSparksRegistryCoId,
		opsRegister,
	},
	bootstrap: {
		err,
		jsonResponse,
		parseBootstrapBody,
		getSparksRegistryCoId,
		opsSync,
		accountID,
		avenMaiaGuardian,
		peerSyncSeed,
		seedVibesConfig,
	},
	extend: {
		err,
		jsonResponse,
		verifyAccountBinding,
		loadCoMap,
		avenMaiaGuardian,
		opsRegister,
	},
})

function handleCORS(req) {
	return new Response(null, {
		status: 204,
		headers: corsHeadersForRequest(req),
	})
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
				return handleLLMChat(
					{
						jsonResponse,
						verifyAccountBinding,
						hasValidCapability,
						redPillApiKey: RED_PILL_API_KEY,
						opsLlm,
					},
					req,
					agentWorker,
				)
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

syncDevLifecycleLog.log(`Listening on 0.0.0.0:${PORT}`)

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
		syncDevLifecycleLog.log('Ready')
	} catch (e) {
		opsSync.error('Init failed:', e?.message ?? e)
		if (e?.stack) opsSync.error('stack', e.stack)
		process.exit(1)
	}
})()
