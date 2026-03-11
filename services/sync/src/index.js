/**
 * Unified Sync Service - WebSocket sync + Agent API + LLM proxy
 *
 * Consolidates: sync (WebSocket), agent (/register, /profile), api (/api/v0/llm/chat)
 *
 * Port: 4201
 *
 * Env vars (required - sync never generates credentials, only reads from env):
 *   AVEN_MAIA_ACCOUNT, AVEN_MAIA_SECRET - From Fly secrets (sync from .env: bun run agent:generate)
 *   PEER_SYNC_STORAGE=pglite | postgres (required - server never runs without persistent storage)
 *     - pglite: PEER_DB_PATH (default ./local-sync.db)
 *     - postgres: PEER_DB_URL (required)
 *   AVEN_MAIA_GUARDIAN: Human account co-id (co_z...). If set, add as admin on startup (one-time genesis). If empty/unset, skip.
 *   PEER_SYNC_SEED: Default false. Set true to run genesis seed (bootstrap + schemas + avens).
 *     - true: Fresh seed (first deploy or intentional reset). May overwrite existing scaffold.
 *     - false/unset: Skip seed, use persisted data. Never overwrite on restart.
 */

import {
	buildSeedConfig,
	createWebSocketPeer,
	DataEngine,
	filterAvensForSeeding,
	generateRegistryName,
	getAllAvenRegistries,
	getAllSchemas,
	getSeedConfig,
	loadOrCreateAgentAccount,
	MaiaDB,
	MaiaScriptEvaluator,
	removeGroupMember,
	resolve,
	schemaMigration,
	waitForStoreReady,
} from '@MaiaOS/loader'
import { agentIDToDidKey, verifyInvocationToken } from '@MaiaOS/maia-ucan'
import { dirname, resolve as pathResolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve db path relative to sync package root (not process.cwd) so persistence is stable across restarts
const _syncDir = pathResolve(dirname(fileURLToPath(import.meta.url)), '..')

const PORT = process.env.PORT || 4201
const PEER_DB_PATH = process.env.PEER_DB_PATH || './local-sync.db'

const accountID = process.env.AVEN_MAIA_ACCOUNT
const agentSecret = process.env.AVEN_MAIA_SECRET
const storageType = process.env.PEER_SYNC_STORAGE || 'pglite'
if (storageType === 'in-memory' || storageType === 'jazz-cloud') {
	throw new Error(
		'[sync] Server requires persistent storage. Use PEER_SYNC_STORAGE=pglite or PEER_SYNC_STORAGE=postgres. No in-memory or jazz-cloud.',
	)
}
const usePGlite = storageType === 'pglite'
const usePostgres = storageType === 'postgres'
if (!usePGlite && !usePostgres) {
	throw new Error(`[sync] PEER_SYNC_STORAGE must be pglite or postgres. Got: ${storageType}`)
}
// Resolve relative to sync package dir (stable across runs regardless of cwd)
const dbPath = usePGlite ? pathResolve(_syncDir, PEER_DB_PATH) : undefined
const MAIA_SPARK = '°Maia'
const RED_PILL_API_KEY = process.env.RED_PILL_API_KEY || ''

const avenMaiaGuardian = process.env.AVEN_MAIA_GUARDIAN?.trim() || null
const peerSyncSeed = process.env.PEER_SYNC_SEED === 'true'
// Sync mode seeds all avens by default (internal, not configurable)
const seedVibesConfig = 'all'

let localNode = null
let agentWorker = null
let syncHandler = null

function jsonResponse(data, status = 200, headers = {}) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers },
	})
}

function err(msg, status = 400, extra = {}) {
	return jsonResponse({ ok: false, error: msg, ...extra }, status)
}

const LOAD_TIMEOUT_MS = 25000
const REQUEST_TIMEOUT_MS = 35000

function withTimeout(promise, ms, label) {
	return Promise.race([
		promise,
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
		),
	])
}

function getRegistriesId(account) {
	const id = account.get('registries')
	if (!id?.startsWith('co_z'))
		throw new Error('account.registries not found. Ensure genesis seeded (PEER_FRESH_SEED=true).')
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

async function getCoIdByPath(peer, startId, path, opts = {}) {
	let content = await loadCoMap(peer, startId, opts)
	for (let i = 0; i < path.length; i++) {
		const nextId = content?.get?.(path[i])
		if (!nextId?.startsWith('co_z')) throw new Error(`Path ${path[i]} not found`)
		if (i === path.length - 1) return nextId
		content = await loadCoMap(peer, nextId, opts)
	}
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

/** Get spark.os.capabilities stream co-id (registries → sparks → °Maia → os → capabilities). */
async function getCapabilitiesStreamId(worker) {
	try {
		return await getCoIdByPath(worker.peer, getRegistriesId(worker.account), [
			'sparks',
			MAIA_SPARK,
			'os',
			'capabilities',
		])
	} catch {
		return null
	}
}

/** Push Capability CoMap to spark.os.capabilities stream. */
async function pushCapabilityToStream(worker, { sub, cmd, pol, exp }) {
	const capabilitiesStreamId = await getCapabilitiesStreamId(worker)
	if (!capabilitiesStreamId?.startsWith('co_z')) return
	const capabilitySchemaCoId = await resolve(worker.peer, '°Maia/schema/os/capability', {
		returnType: 'coId',
	})
	if (!capabilitySchemaCoId) return
	try {
		const createResult = await worker.dataEngine.execute({
			op: 'create',
			schema: capabilitySchemaCoId,
			data: { sub, cmd, pol, exp },
			spark: MAIA_SPARK,
		})
		const capabilityCoId = createResult?.data?.id ?? createResult?.id
		if (!capabilityCoId?.startsWith('co_z')) return
		await worker.dataEngine.execute({
			op: 'append',
			coId: capabilitiesStreamId,
			item: capabilityCoId,
			cotype: 'costream',
		})
	} catch (e) {
		console.warn('[register] Failed to push capability to stream', e?.message)
	}
}

/** Check if account has valid /llm/chat capability from spark.os.capabilities stream. */
async function hasValidLlmCapability(worker, accountId) {
	if (!accountId?.startsWith('co_z')) return false
	const capabilitiesStreamId = await getCapabilitiesStreamId(worker)
	if (!capabilitiesStreamId?.startsWith('co_z')) return false
	try {
		const core = worker.peer.node.getCoValue(capabilitiesStreamId)
		if (!core || !worker.peer.isAvailable(core)) return false
		const content = worker.peer.getCurrentContent(core)
		if (!content || content.type !== 'costream' || !content.items) return false
		const now = Math.floor(Date.now() / 1000)
		const allCoIds = []
		for (const items of Object.values(content.items)) {
			if (!Array.isArray(items)) continue
			for (const item of items) {
				const v = item?.value
				if (typeof v === 'string' && v.startsWith('co_z')) allCoIds.push(v)
			}
		}
		for (const capCoId of allCoIds) {
			const capContent = await loadCoMap(worker.peer, capCoId, { retries: 1 })
			if (!capContent?.get) continue
			const sub = capContent.get('sub')
			const cmd = capContent.get('cmd')
			const exp = capContent.get('exp')
			if (sub === accountId && cmd === '/llm/chat' && typeof exp === 'number' && exp > now) return true
		}
		return false
	} catch {
		return false
	}
}

/** Returns account.registries + °Maia spark for human/agent to link. Set account.registries; sparks resolved via registries.sparks. */
async function handleSyncRegistry(worker) {
	try {
		const registriesId = getRegistriesId(worker.account)
		const registriesContent = await loadCoMap(worker.peer, registriesId, { retries: 2 })
		const sparksId = registriesContent?.get?.('sparks')
		let maiaSparkId = null
		if (sparksId?.startsWith('co_z')) {
			const sparksContent = await loadCoMap(worker.peer, sparksId, { retries: 2 })
			maiaSparkId = sparksContent?.get?.(MAIA_SPARK)
		}
		return jsonResponse({
			registries: registriesId,
			...(maiaSparkId?.startsWith('co_z') && { '°Maia': maiaSparkId }),
		})
	} catch (e) {
		return err(e?.message ?? 'failed to get sync registry', 500)
	}
}

// --- Agent handlers ---
async function handleRegister(worker, body) {
	const { type, username, accountId, profileId, sparkCoId } = body || {}
	if (type !== 'human' && type !== 'spark')
		return err('type required: human or spark', 400, {
			validationErrors: [{ field: 'type', message: 'must be human or spark' }],
		})
	if (type === 'human' && (!accountId || typeof accountId !== 'string'))
		return err('accountId required for type=human', 400, {
			validationErrors: [{ field: 'accountId', message: 'required' }],
		})
	if (
		type === 'human' &&
		(!profileId || typeof profileId !== 'string' || !profileId.startsWith('co_z'))
	)
		return err('profileId required for type=human', 400, {
			validationErrors: [{ field: 'profileId', message: 'required (co_z...)' }],
		})
	if (type === 'spark' && (!sparkCoId || typeof sparkCoId !== 'string'))
		return err('sparkCoId required for type=spark', 400, {
			validationErrors: [{ field: 'sparkCoId', message: 'required' }],
		})

	const coId = type === 'human' ? accountId : sparkCoId
	let u =
		username != null && typeof username === 'string' && username.trim() ? username.trim() : null

	const { peer, dataEngine } = worker
	try {
		const registryKey = type === 'human' ? 'humans' : 'sparks'
		const registryId = await getCoIdByPath(peer, getRegistriesId(worker.account), [registryKey], {
			retries: 2,
		})
		const raw = await peer.getRawRecord(registryId)

		if (type === 'human') {
			// Idempotency: accountId already registered (by username or by accountId key)
			const existingHumanId = raw?.[accountId]
			if (existingHumanId?.startsWith('co_z')) {
				const now = Math.floor(Date.now() / 1000)
				const oneYear = 365 * 24 * 3600
				try {
					const humanContent = await loadCoMap(peer, existingHumanId, { retries: 1 })
					let llmExp = humanContent?.get?.('llmExp')
					if (llmExp == null || llmExp < now) {
						const newExp = now + oneYear
						await dataEngine.execute({ op: 'update', id: existingHumanId, data: { llmExp: newExp } })
						llmExp = newExp
					}
					await pushCapabilityToStream(worker, {
						sub: accountId,
						cmd: '/llm/chat',
						pol: [],
						exp: llmExp,
					})
				} catch (_e) {
					// Non-fatal: capability refresh failed, still return ok
				}
				const existingUsername = raw
					? Object.keys(raw).find((k) => raw[k] === existingHumanId && k !== accountId)
					: null
				return jsonResponse({
					ok: true,
					type: 'human',
					username: existingUsername ?? generateRegistryName(type),
					accountId: coId,
				})
			}
			const existingUsername = raw ? Object.keys(raw).find((k) => raw[k] === coId) : null
			if (!u) u = existingUsername ?? generateRegistryName(type)
			if (raw?.[u] != null && raw[u] !== coId)
				return err(`username "${u}" already registered to different identity`, 409)

			// Create Human CoMap (public: everyone reader) and dual-key registry
			const humanSchemaCoId = await resolve(peer, '°Maia/schema/os/human', { returnType: 'coId' })
			if (!humanSchemaCoId) return err('Human schema not found. Ensure genesis seed has run.', 500)

			const guardian = await peer.getMaiaGroup()
			if (!guardian) return err('Guardian not found', 500)

			const node = peer.node
			const humanGroup = node.createGroup()
			humanGroup.extend(guardian, 'extend')
			humanGroup.addMember('everyone', 'reader')
			const llmExp = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
			const humanCoMap = humanGroup.createMap(
				{ account: accountId, profile: profileId, llmExp },
				{ $schema: humanSchemaCoId },
			)
			const memberIdToRemove =
				typeof node.getCurrentAccountOrAgentID === 'function'
					? node.getCurrentAccountOrAgentID()
					: (worker.account?.id ?? worker.account?.$jazz?.id)
			try {
				await removeGroupMember(humanGroup, memberIdToRemove)
			} catch (_e) {}

			const registryData = { [u]: humanCoMap.id, [accountId]: humanCoMap.id }
			const r = await dataEngine.execute({ op: 'update', id: registryId, data: registryData })
			if (r?.ok === false)
				return err(r.errors?.map((e) => e.message).join('; ') ?? 'update failed', 500)
			await pushCapabilityToStream(worker, {
				sub: accountId,
				cmd: '/llm/chat',
				pol: [],
				exp: llmExp,
			})
			return jsonResponse({
				ok: true,
				type: 'human',
				username: u,
				accountId: coId,
			})
		}

		// Spark registration (unchanged)
		if (!u) u = generateRegistryName(type)
		if (raw?.[u] != null && raw[u] !== coId)
			return err(`username "${u}" already registered to different identity`, 409)
		const r = await dataEngine.execute({ op: 'update', id: registryId, data: { [u]: coId } })
		if (r?.ok === false)
			return err(r.errors?.map((e) => e.message).join('; ') ?? 'update failed', 500)
		return jsonResponse({
			ok: true,
			type,
			username: u,
			accountId: type === 'human' ? coId : undefined,
			sparkCoId: type === 'spark' ? coId : undefined,
		})
	} catch (e) {
		return err(e?.message ?? 'failed to register', 500)
	}
}

async function handleProfile(worker) {
	try {
		const { account, peer } = worker
		const profileId = account?.get?.('profile')
		const registriesId = account?.get?.('registries')
		let sparks = null
		if (registriesId?.startsWith('co_z')) {
			try {
				const registriesContent = await loadCoMap(backend, registriesId, { retries: 2 })
				const sparksId = registriesContent?.get?.('sparks')
				if (sparksId?.startsWith('co_z')) {
					const c = await loadCoMap(peer, sparksId, { retries: 2 })
					if (c?.get) {
						sparks = {}
						const keys = typeof c.keys === 'function' ? Array.from(c.keys()) : Object.keys(c ?? {})
						for (const k of keys) {
							const val = c.get(k)
							if (val && typeof val === 'string' && val.startsWith('co_z')) sparks[k] = val
						}
					}
				}
			} catch (e) {
				sparks = { _error: e?.message ?? 'failed to load' }
			}
		}
		let profileName = null
		if (profileId?.startsWith('co_z')) {
			const store = await peer.read(null, profileId)
			await waitForStoreReady(store, profileId, 5000).catch(() => {})
			const d = store?.value
			if (d && !d.error) profileName = d?.name ?? d?.properties?.name ?? null
		}
		return jsonResponse({
			accountId: account?.id ?? account?.$jazz?.id,
			profileId,
			registriesId: registriesId ?? null,
			sparks,
			profileName: profileName ?? '(not loaded)',
		})
	} catch (e) {
		return err(e.message, 500)
	}
}

async function handleAgentHttp(req, worker) {
	const url = new URL(req.url)
	if (url.pathname === '/profile' && req.method === 'GET') return handleProfile(worker)
	const post = async (strict, handler) => {
		try {
			const body = strict ? await req.json() : await req.json().catch(() => ({}))
			return await handler(worker, body)
		} catch (e) {
			return err(e.message, e?.message?.includes('timed out') ? 504 : 400)
		}
	}
	if (url.pathname === '/register' && req.method === 'POST')
		return post(false, (w, b) => withTimeout(handleRegister(w, b), REQUEST_TIMEOUT_MS, '/register'))
	return null
}

/** LLM proxy: forwards request to RedPill, returns response. Tool execution is client-side (Runtime). Requires Bearer token + valid /llm/chat capability. */
async function handleLLMChat(req, worker) {
	if (!RED_PILL_API_KEY) return jsonResponse({ error: 'RED_PILL_API_KEY not configured' }, 500)
	if (!worker) return jsonResponse({ error: 'Initializing', status: 503 }, 503)

	// Auth gate: Bearer token + account binding + capability
	const auth = req.headers.get('Authorization')
	const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
	if (!token) {
		return jsonResponse({ error: 'Unauthorized', message: 'Bearer token required' }, 401)
	}
	let payload
	try {
		payload = verifyInvocationToken(token, {
			now: Math.floor(Date.now() / 1000),
			allowedCmd: '/llm/chat',
		})
	} catch {
		return jsonResponse({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401)
	}
	const accountId = payload?.accountId
	if (!accountId?.startsWith('co_z')) {
		return jsonResponse({ error: 'Forbidden', message: 'Invalid token claims' }, 403)
	}
	const bindingOk = await verifyAccountBinding(worker.peer, accountId, payload.iss)
	if (!bindingOk) {
		console.warn('[llm] Account binding failed', { accountId: accountId?.slice(0, 12) })
		return jsonResponse({ error: 'Forbidden', message: 'Account binding verification failed' }, 403)
	}
	const hasCap = await hasValidLlmCapability(worker, accountId)
	if (!hasCap) {
		console.warn('[llm] No valid capability', { accountId: accountId?.slice(0, 12) })
		return jsonResponse(
			{
				error: 'Forbidden',
				message: 'No valid /llm/chat capability. Ask a guardian to grant you access in Capabilities.',
			},
			403,
		)
	}

	try {
		const body = await req.json()
		const { messages, model = 'qwen/qwen3-30b-a3b-instruct-2507', temperature = 1, tools } = body
		if (!messages || !Array.isArray(messages) || messages.length === 0)
			return jsonResponse({ error: 'messages array required' }, 400)

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
			console.error('[llm] RedPill upstream error', res.status, data.error || txt.slice(0, 200))
			return jsonResponse(
				{ error: data.error || `HTTP ${res.status}`, message: data.message || txt.slice(0, 200) },
				500,
			)
		}
		const data = JSON.parse(txt)
		return jsonResponse(data)
	} catch (e) {
		const msg = e?.message ?? String(e)
		console.error('[llm]', msg, e)
		return jsonResponse({ error: 'Failed to process LLM request', message: msg }, 500)
	}
}

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function handleCORS() {
	return new Response(null, {
		status: 204,
		headers: CORS_HEADERS,
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
		const url = new URL(req.url)

		if (req.method === 'OPTIONS') return handleCORS()

		if (url.pathname === '/health') {
			return jsonResponse({ status: 'ok', service: 'sync', ready: !!syncHandler })
		}

		if (url.pathname === '/syncRegistry' && req.method === 'GET') {
			if (!agentWorker) return jsonResponse({ error: 'Initializing', status: 503 }, 503)
			return withTimeout(handleSyncRegistry(agentWorker), REQUEST_TIMEOUT_MS, '/syncRegistry')
		}

		if (url.pathname === '/sync') {
			if (!syncHandler) return jsonResponse({ error: 'Initializing', status: 503 }, 503)
			if (req.headers.get('upgrade') !== 'websocket')
				return new Response('Expected WebSocket upgrade', {
					status: 426,
					headers: CORS_HEADERS,
				})
			const ok = srv.upgrade(req, { data: {}, headers: CORS_HEADERS })
			return ok
				? undefined
				: new Response('Failed to upgrade', {
						status: 500,
						headers: CORS_HEADERS,
					})
		}

		// Agent routes (require agentWorker)
		if (agentWorker) {
			const agentRes = await handleAgentHttp(req, agentWorker)
			if (agentRes) return agentRes
		} else if (
			url.pathname.startsWith('/register') ||
			url.pathname.startsWith('/profile') ||
			url.pathname.startsWith('/syncRegistry')
		) {
			return jsonResponse({ error: 'Initializing', status: 503 }, 503)
		}

		// API (LLM)
		if (url.pathname === '/api/v0/llm/chat' && req.method === 'POST') {
			if (!agentWorker) return jsonResponse({ error: 'Initializing', status: 503 }, 503)
			return handleLLMChat(req, agentWorker)
		}

		return new Response('Not Found', { status: 404, headers: CORS_HEADERS })
	},
	websocket: {
		async open(ws) {
			if (syncHandler) await syncHandler.open(ws)
			else ws.close(1008, 'Sync initializing')
		},
		async message(ws, msg) {
			await syncHandler?.message(ws, msg)
		},
		async close(ws, code, reason) {
			syncHandler?.close(ws, code, reason)
		},
		error(_ws, _err) {},
	},
})

console.log(`[sync] Listening on 0.0.0.0:${PORT}`)

;(async () => {
	try {
		if (!accountID || !agentSecret) {
			throw new Error('AVEN_MAIA_ACCOUNT and AVEN_MAIA_SECRET required. Run: bun agent:generate')
		}

		if (dbPath && !process.env.PEER_DB_PATH) process.env.PEER_DB_PATH = dbPath

		const storageLabel = usePostgres ? 'Postgres' : `PGlite at ${dbPath || './local-sync.db'}`
		console.log('[sync] Loading account (%s)...', storageLabel)
		console.log('[sync] accountID=%s', `${accountID?.slice(0, 12)}...`)
		if (!RED_PILL_API_KEY) {
			console.warn(
				'[sync] RED_PILL_API_KEY not set — LLM chat will return 500. Add to root .env and restart.',
			)
		}

		const result = await loadOrCreateAgentAccount({
			accountID,
			agentSecret,
			syncDomain: null,
			dbPath,
			createName: 'Agent Moai',
		})

		localNode = result.node
		localNode.enableGarbageCollector()

		// Graceful shutdown: flush pending storage writes before exit (ensures scaffold persists)
		const shutdown = async () => {
			try {
				if (localNode?.syncManager?.gracefulShutdown) {
					await localNode.syncManager.gracefulShutdown()
				}
			} catch (e) {
				console.error('[sync] Graceful shutdown error:', e?.message ?? e)
			}
			process.exit(0)
		}
		process.on('SIGTERM', () => shutdown())
		process.on('SIGINT', () => shutdown())

		const peer = new MaiaDB({ node: localNode, account: result.account }, { systemSpark: '°Maia' })
		const evaluator = new MaiaScriptEvaluator()
		const dataEngine = new DataEngine(peer, { evaluator })
		peer.dbEngine = dataEngine
		agentWorker = { node: localNode, account: result.account, peer, dataEngine }

		// Ensure migration completes before seed (sparkGuardian -> guardian, registries.humans)
		// loadAccount defers migration; seed needs guardian in os.groups
		await schemaMigration(result.account, localNode)

		// Genesis: seed only when PEER_SYNC_SEED=true (explicit, no co-value inference).
		if (peerSyncSeed) {
			const allAvenRegistries = await getAllAvenRegistries()
			const avenRegistries = await filterAvensForSeeding(allAvenRegistries, seedVibesConfig)
			if (avenRegistries.length === 0) {
				throw new Error(
					'[sync] Genesis sync requires avens. getAllAvenRegistries returned none or SEED_AVENS filtered all.',
				)
			}
			const { configs: mergedConfigs, data } = await buildSeedConfig(avenRegistries)
			const {
				actors: serviceActors,
				interfaces: serviceInterfaces,
				inboxes: serviceInboxes,
				contexts: actorContexts,
				views: actorViews,
				processes: actorProcesses,
				styles: actorStyles,
			} = getSeedConfig()
			const configsForSeed = {
				...mergedConfigs,
				actors: { ...mergedConfigs.actors, ...serviceActors },
				states: mergedConfigs.states,
				interfaces: { ...(mergedConfigs.interfaces || {}), ...serviceInterfaces },
				inboxes: { ...mergedConfigs.inboxes, ...serviceInboxes },
				contexts: { ...mergedConfigs.contexts, ...(actorContexts || {}) },
				views: { ...mergedConfigs.views, ...(actorViews || {}) },
				processes: { ...mergedConfigs.processes, ...(actorProcesses || {}) },
				styles: { ...mergedConfigs.styles, ...(actorStyles || {}) },
			}
			const schemas = getAllSchemas()
			const seedResult = await dataEngine.execute({
				op: 'seed',
				configs: configsForSeed,
				schemas,
				data,
				forceFreshSeed: true, // PEER_SYNC_SEED=true: always bootstrap, bypass idempotency
			})
			if (seedResult?.ok === false && seedResult?.errors?.length) {
				const msg = seedResult.errors.map((e) => e?.message ?? e).join('; ')
				throw new Error(`[sync] Genesis seed failed: ${msg}`)
			}
			console.log(
				`[sync] Genesis seeded: ${avenRegistries.length} aven(s) (schemas + scaffold). Set PEER_SYNC_SEED=false for subsequent restarts.`,
			)
		} else {
			console.log('[sync] PEER_SYNC_SEED not set — using persisted scaffold (skip seed).')
		}

		// One-time: add AVEN_MAIA_GUARDIAN (human account co-id) as admin of °Maia spark guardian group
		if (avenMaiaGuardian?.startsWith('co_z')) {
			try {
				const guardian = await agentWorker.peer.getMaiaGroup()
				if (guardian) {
					await agentWorker.peer.addGroupMember(guardian, avenMaiaGuardian, 'admin')
					console.log('[sync] Added guardian as admin of °Maia spark.')
				} else {
					console.warn(
						'[sync] AVEN_MAIA_GUARDIAN set but °Maia spark guardian not found (ensure genesis seeded first)',
					)
				}
			} catch (e) {
				console.error('[sync] Failed to add guardian:', e?.message ?? e)
			}
		}

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
		console.log('[sync] Ready')
	} catch (e) {
		console.error('[sync] Init failed:', e?.message ?? e)
		if (e?.stack) console.error(e.stack)
		process.exit(1)
	}
})()
