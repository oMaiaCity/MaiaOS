/**
 * Unified Sync Service - WebSocket sync + Agent API + LLM proxy
 *
 * Consolidates: sync (WebSocket), agent (/on-added, /register-human, /trigger, /profile), api (/api/v0/llm/chat)
 *
 * Port: 4201
 *
 * Env vars (required - moai never generates credentials, only reads from env):
 *   PEER_ID, PEER_SECRET - From Fly secrets (sync from .env: bun run deploy:secrets)
 *   PEER_MODE=sync | agent
 *     - sync: I host /sync (moai). Never connect to another. syncDomain=null.
 *     - agent: Client agent. Connects to sync at PEER_MOAI. Use for future pure agent workers.
 *   PEER_STORAGE, DB_PATH
 *   PEER_MOAI: Required when PEER_MODE=agent (where to connect). Ignored when sync.
 */

import { CoJSONBackend, waitForStoreReady } from '@MaiaOS/db'
import { loadOrCreateAgentAccount } from '@MaiaOS/kernel'
import { DBEngine } from '@MaiaOS/operations'
import { createWebSocketPeer } from 'cojson-transport-ws'

const PORT = process.env.PORT || 4201
const DB_PATH = process.env.DB_PATH || './local-sync.db'

const accountID = process.env.PEER_ID
const agentSecret = process.env.PEER_SECRET
const storageType = process.env.PEER_STORAGE || 'pglite'
const usePGlite = storageType === 'pglite'
const usePostgres = storageType === 'postgres'
const dbPath = usePGlite ? DB_PATH : undefined
const peerMode = process.env.PEER_MODE || 'sync'
const syncDomain = peerMode === 'agent' ? process.env.PEER_MOAI || null : null
const RED_PILL_API_KEY = process.env.RED_PILL_API_KEY || ''

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

function getSparksId(account) {
	const id = account.get('sparks')
	if (!id?.startsWith('co_z'))
		throw new Error('account.sparks not found. Ensure bootstrap completed.')
	return id
}

async function loadCoMap(backend, coId, opts = {}) {
	const { timeout = LOAD_TIMEOUT_MS, retries = 1 } = opts
	let lastErr
	for (let i = 1; i <= retries; i++) {
		try {
			const store = await backend.read(null, coId)
			await withTimeout(waitForStoreReady(store, coId, timeout), timeout, `load(${coId.slice(0, 12)})`)
			const core = backend.node.getCoValue(coId)
			if (core && backend.isAvailable(core)) return backend.getCurrentContent(core)
			lastErr = new Error(`CoMap ${coId.slice(0, 12)}... not available`)
		} catch (e) {
			lastErr = e
			if (i < retries) await new Promise((r) => setTimeout(r, 500))
		}
	}
	throw lastErr
}

async function getCoIdByPath(backend, startId, path, opts = {}) {
	let content = await loadCoMap(backend, startId, opts)
	for (let i = 0; i < path.length; i++) {
		const nextId = content?.get?.(path[i])
		if (!nextId?.startsWith('co_z')) throw new Error(`Path ${path[i]} not found`)
		if (i === path.length - 1) return nextId
		content = await loadCoMap(backend, nextId, opts)
	}
}

// --- Agent handlers ---
async function handleOnAdded(worker, body) {
	const { sparkId } = body || {}
	if (!sparkId || typeof sparkId !== 'string' || !sparkId.startsWith('co_z'))
		return err('sparkId required (co_z...)')
	const { backend } = worker
	try {
		const sparksContent = await loadCoMap(backend, getSparksId(worker.account), { retries: 2 })
		if (!sparksContent?.set) throw new Error('sparks CoMap not writable')
		sparksContent.set('@maia', sparkId)
		return jsonResponse({ ok: true, added: '@maia', sparkId })
	} catch (e) {
		return err(e?.message ?? 'failed to ensure sparks registry', 500)
	}
}

async function handleRegisterHuman(worker, body) {
	const { username, accountId } = body || {}
	if (!username || typeof username !== 'string' || !username.trim())
		return err('username required', 400, {
			validationErrors: [{ field: 'username', message: 'required' }],
		})
	const u = username.trim()
	if (!accountId || typeof accountId !== 'string')
		return err('accountId required', 400, {
			validationErrors: [{ field: 'accountId', message: 'required' }],
		})
	const { backend, dbEngine } = worker
	try {
		const humansId = await getCoIdByPath(
			backend,
			getSparksId(worker.account),
			['@maia', 'registries', 'humans'],
			{ retries: 2 },
		)
		const raw = await backend.getRawRecord(humansId)
		if (raw?.[u] != null && raw[u] !== accountId)
			return err('username already registered to different account', 409)
		const r = await dbEngine.execute({ op: 'update', id: humansId, data: { [u]: accountId } })
		if (r?.ok === false)
			return err(r.errors?.map((e) => e.message).join('; ') ?? 'update failed', 500)
		return jsonResponse({ ok: true, username: u, accountId })
	} catch (e) {
		return err(e?.message ?? 'failed to register', 500)
	}
}

async function handleTrigger(worker, body) {
	const { dbEngine } = worker
	const text = body?.text ?? 'Test todo from agent'
	let spark = body?.spark
	if (spark == null) {
		try {
			const sparksId = worker.account.get('sparks')
			if (sparksId?.startsWith('co_z')) {
				const sparksContent = await loadCoMap(worker.backend, sparksId, { retries: 2 })
				if (sparksContent?.get?.('@maia')) spark = '@maia'
			}
		} catch (_) {}
		spark = spark ?? '@maia'
	}
	try {
		const r = await dbEngine.execute({
			op: 'create',
			schema: '@maia/schema/data/todos',
			data: { text, done: false },
			spark,
		})
		if (r?.ok === false) return err(r.errors?.map((e) => e.message).join('; ') ?? 'create failed')
		return jsonResponse({ ok: true, created: r?.data?.id ?? r?.id, spark, text })
	} catch (e) {
		return err(e.message, 500)
	}
}

async function handleProfile(worker) {
	try {
		const { account, backend } = worker
		const profileId = account?.get?.('profile')
		const sparksId = account?.get?.('sparks')
		let profileName = null
		if (profileId?.startsWith('co_z')) {
			const store = await backend.read(null, profileId)
			await waitForStoreReady(store, profileId, 5000).catch(() => {})
			const d = store?.value
			if (d && !d.error) profileName = d?.name ?? d?.properties?.name ?? null
		}
		let sparks = null
		if (sparksId?.startsWith('co_z')) {
			try {
				const c = await loadCoMap(backend, sparksId, { retries: 2 })
				if (c?.get) {
					sparks = {}
					const keys = c.keys?.() ?? Object.keys(c)
					for (const k of keys) sparks[k] = c.get(k)
				}
			} catch (e) {
				sparks = { _error: e?.message ?? 'failed to load' }
			}
		}
		return jsonResponse({
			accountId: account?.id ?? account?.$jazz?.id,
			profileId,
			sparksId,
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
	if (url.pathname === '/on-added' && req.method === 'POST')
		return post(true, (w, b) => withTimeout(handleOnAdded(w, b), REQUEST_TIMEOUT_MS, '/on-added'))
	if (url.pathname === '/register-human' && req.method === 'POST')
		return post(false, (w, b) =>
			withTimeout(handleRegisterHuman(w, b), REQUEST_TIMEOUT_MS, '/register-human'),
		)
	if (url.pathname === '/trigger' && req.method === 'POST') return post(false, handleTrigger)
	return null
}

// --- API (LLM) handler ---
async function handleLLMChat(req) {
	if (!RED_PILL_API_KEY) return jsonResponse({ error: 'RED_PILL_API_KEY not configured' }, 500)
	try {
		const body = await req.json()
		const { messages, model = 'qwen/qwen3-30b-a3b-instruct-2507', temperature = 1 } = body
		if (!messages || !Array.isArray(messages) || messages.length === 0)
			return jsonResponse({ error: 'messages array required' }, 400)
		const res = await fetch('https://api.redpill.ai/v1/chat/completions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RED_PILL_API_KEY}` },
			body: JSON.stringify({ model, messages, temperature }),
		})
		if (!res.ok) {
			const txt = await res.text()
			let data = { error: 'LLM request failed' }
			try {
				data = JSON.parse(txt)
			} catch {}
			return jsonResponse(
				{ error: data.error || `HTTP ${res.status}`, message: data.message || txt.slice(0, 200) },
				500,
			)
		}
		const data = await res.json()
		const choice = data.choices?.[0]
		return jsonResponse({
			content: choice?.message?.content ?? '',
			role: 'assistant',
			usage: data.usage ?? null,
		})
	} catch (e) {
		const msg = e?.message ?? String(e)
		console.error('[llm]', msg, e)
		return jsonResponse(
			{ error: 'Failed to process LLM request', message: msg },
			500,
		)
	}
}

function handleCORS() {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
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

		if (url.pathname === '/sync') {
			if (!syncHandler) return jsonResponse({ error: 'Initializing', status: 503 }, 503)
			if (req.headers.get('upgrade') !== 'websocket')
				return new Response('Expected WebSocket upgrade', { status: 426 })
			const ok = srv.upgrade(req, { data: {} })
			return ok ? undefined : new Response('Failed to upgrade', { status: 500 })
		}

		// Agent routes (require agentWorker)
		if (agentWorker) {
			const agentRes = await handleAgentHttp(req, agentWorker)
			if (agentRes) return agentRes
		} else if (
			url.pathname.startsWith('/on-added') ||
			url.pathname.startsWith('/register-human') ||
			url.pathname.startsWith('/trigger') ||
			url.pathname.startsWith('/profile')
		) {
			return jsonResponse({ error: 'Initializing', status: 503 }, 503)
		}

		// API (LLM)
		if (url.pathname === '/api/v0/llm/chat' && req.method === 'POST') return handleLLMChat(req)

		return new Response('Not Found', { status: 404 })
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
			throw new Error('PEER_ID and PEER_SECRET required. Run: bun agent:generate')
		}

		if (dbPath && !process.env.DB_PATH) process.env.DB_PATH = dbPath

		const storageLabel = usePostgres
			? 'Postgres'
			: usePGlite
				? `PGlite at ${dbPath || './local-sync.db'}`
				: 'in-memory'
		console.log('[sync] Loading account (%s)...', storageLabel)
		console.log('[sync] accountID=%s', `${accountID?.slice(0, 12)}...`)
		const result = await loadOrCreateAgentAccount({
			accountID,
			agentSecret,
			syncDomain,
			dbPath: usePGlite ? dbPath : undefined,
			inMemory: storageType === 'in-memory',
			createName: 'Maia Sync Server',
		})

		localNode = result.node
		localNode.enableGarbageCollector()

		const backend = new CoJSONBackend(localNode, result.account, { systemSpark: '@maia' })
		const dbEngine = new DBEngine(backend)
		backend.dbEngine = dbEngine
		agentWorker = { node: localNode, account: result.account, backend, dbEngine }

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
	} catch (_e) {
		process.exit(1)
	}
})()
