/**
 * Unified Sync Service - WebSocket sync + Agent API + LLM proxy
 *
 * Consolidates: sync (WebSocket), agent (/register), api (/api/v0/llm/chat)
 *
 * Port: 4201
 *
 * Env vars (required - sync never generates credentials, only reads from env):
 *   AVEN_MAIA_ACCOUNT, AVEN_MAIA_SECRET - From Fly secrets (sync from .env: bun run agent:generate)
 *   PEER_SYNC_STORAGE=pglite | postgres (required - server never runs without persistent storage)
 *     - pglite: PEER_DB_PATH (default ./pg-lite.db)
 *     - postgres: PEER_SYNC_DB_URL (required)
 *   AVEN_MAIA_GUARDIAN: Human account co-id (co_z...). If set, add as admin of °maia spark guardian; also seeds /sync/write so that account can sync without POST /register.
 *   PEER_SYNC_SEED: Default false. Set true to run genesis seed (bootstrap + schemas + vibes).
 *     - true: Fresh seed (first deploy or intentional reset). May overwrite existing scaffold.
 *     - false/unset: Skip seed, use persisted data. Never overwrite on restart.
 *   SEED_VIBES: Default "all". Which vibes to seed (todos, chat, quickjs, etc). "all" seeds every vibe including quickjs.
 *   PEER_APP_HOST: Allowed CORS origin (e.g. https://next.maia.city). When set, only that origin can call sync/LLM in production. Unset = * (dev).
 *   MAIA_DEV_CORS=1: With Postgres local dev, enable same multi-origin dev CORS as PGlite (localhost / 127.0.0.1 / ::1 on port 4200).
 */

import {
	accountHasCapabilityOnPeer,
	getRuntimeRef,
	RUNTIME_REF,
	resolveInfraFactoryCoId,
} from '@MaiaOS/db'
import { createOpsLogger, OPS_PREFIX } from '@MaiaOS/logs'
import { agentIDToDidKey, verifyInvocationToken } from '@MaiaOS/maia-ucan'
import {
	createWebSocketPeer,
	DataEngine,
	ensureProfileForNewAccount,
	generateRegistryName,
	loadOrCreateAgentAccount,
	MaiaDB,
	MaiaScriptEvaluator,
	removeGroupMember,
	SYSTEM_SPARK_REGISTRY_KEY,
	waitForStoreReady,
} from '@MaiaOS/runtime'
import { buildSeedConfig, filterVibesForSeeding, getSeedConfig } from '@MaiaOS/seed'
import { dirname, resolve as pathResolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const avenMaiaGuardian = process.env.AVEN_MAIA_GUARDIAN?.trim() || null
const peerSyncSeed = process.env.PEER_SYNC_SEED === 'true'
// SEED_VIBES: which vibes to seed on genesis. Default "all" (includes quickjs). Override: "todos,chat" or "todos,chat,quickjs"
const seedVibesConfig = process.env.SEED_VIBES || 'all'

/** CORS: PEER_APP_HOST = allowed origin (e.g. https://next.maia.city or localhost:4200). When unset, * (dev). */
function normalizeCorsOrigin(host) {
	if (!host) return '*'
	const trimmed = host.trim()
	if (!trimmed) return '*'
	if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
		return `http://${trimmed}`
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
const CONFIGURED_CORS_ORIGIN = rawPeerAppHost ? normalizeCorsOrigin(rawPeerAppHost) : null

/** Per-request CORS: dev reflects Origin from allowlist; prod matches CONFIGURED_CORS_ORIGIN only; unset PEER_APP_HOST → *. */
function corsHeadersForRequest(req) {
	const base = {
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	}
	if (!CONFIGURED_CORS_ORIGIN) {
		return { ...base, 'Access-Control-Allow-Origin': '*' }
	}
	const origin = req?.headers?.get?.('Origin') ?? null
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

/** Create Capability CoMap; index hook appends to spark.os.indexes[capability schema]. Skips if a non-expired grant for the same sub+cmd already exists. */
async function ensureCapabilityGrant(worker, { sub, cmd, pol, exp }) {
	const peer = worker.peer
	if (!resolveInfraFactoryCoId(peer, RUNTIME_REF.OS_CAPABILITY)) {
		await worker.dataEngine.resolveSystemFactories()
	}
	if (await accountHasCapabilityOnPeer(peer, worker.account, sub, cmd)) return
	const capabilitySchemaCoId = resolveInfraFactoryCoId(peer, RUNTIME_REF.OS_CAPABILITY)
	if (!capabilitySchemaCoId) {
		opsRegister.warn(
			'ensureCapabilityGrant: OS_CAPABILITY factory missing after resolveSystemFactories',
			{
				sub: sub?.slice(0, 14),
				cmd,
			},
		)
		return
	}
	try {
		await worker.dataEngine.execute({
			op: 'create',
			factory: capabilitySchemaCoId,
			data: { sub, cmd, pol, exp },
			spark: peer.systemSparkCoId,
		})
	} catch (e) {
		opsRegister.warn('Failed to create capability grant', e?.message)
	}
}

/**
 * For every humans registry key that is an account co-id (co_z...), ensure /llm/chat and /sync/write.
 * Repairs pre-grant registries and cases where POST /register did not create grants.
 */
async function ensureCapabilityGrantsForRegisteredHumanAccountKeys(worker) {
	const { peer, account } = worker
	let registryId
	try {
		registryId = await getCoIdByPath(peer, getRegistriesId(account), ['humans'], { retries: 2 })
	} catch (e) {
		opsRegister.warn(
			'ensureCapabilityGrantsForRegisteredHumanAccountKeys: no humans registry',
			e?.message,
		)
		return
	}
	const raw = await peer.getRawRecord(registryId)
	if (!raw || typeof raw !== 'object') return
	const exp = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
	for (const k of Object.keys(raw)) {
		if (!k.startsWith('co_z')) continue
		const v = raw[k]
		if (typeof v !== 'string' || !v.startsWith('co_z')) continue
		await ensureCapabilityGrant(worker, { sub: k, cmd: '/llm/chat', pol: [], exp })
		await ensureCapabilityGrant(worker, { sub: k, cmd: '/sync/write', pol: [], exp })
	}
}

/** Ensure AVEN_MAIA_ACCOUNT has /admin capability (grants all endpoints). Seeded at sync startup. */
async function seedAdminCapabilityForServerAccount(worker) {
	if (!accountID?.startsWith('co_z')) return
	const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600 // 10 years
	await ensureCapabilityGrant(worker, { sub: accountID, cmd: '/admin', pol: [], exp })
}

/**
 * Ensure AVEN_MAIA_GUARDIAN has /sync/write and /llm/chat (same grants as POST /register for humans).
 * Without this, the guardian’s browser session syncs but every write hits ValidationHook — they never called /register.
 */
async function seedCapabilitiesForGuardian(worker) {
	if (!avenMaiaGuardian?.startsWith('co_z')) return
	if (avenMaiaGuardian === accountID) return
	const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600
	for (const cmd of ['/sync/write', '/llm/chat']) {
		await ensureCapabilityGrant(worker, { sub: avenMaiaGuardian, cmd, pol: [], exp })
	}
}

/** Check if account has valid capability from Capability index CoList. /admin grants all. */
async function hasValidCapability(worker, accountId, cmd) {
	const peer = worker.peer
	if (!resolveInfraFactoryCoId(peer, RUNTIME_REF.OS_CAPABILITY)) {
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
		const registriesId = getRegistriesId(worker.account)
		const registriesContent = await loadCoMap(worker.peer, registriesId, { retries: 1 })
		// Check registries.sparks (agent may be registered as a spark)
		const sparksId = registriesContent?.get?.('sparks')
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
		// Check registries.humans
		const humansId = registriesContent?.get?.('humans')
		if (humansId?.startsWith('co_z')) {
			const raw = await worker.peer.getRawRecord(humansId)
			if (raw) {
				const accountIds = Object.keys(raw).filter((k) => k.startsWith('co_z'))
				for (const accountId of accountIds) {
					try {
						const core = worker.peer.node.getCoValue(accountId)
						if (!core || !worker.peer.isAvailable(core)) continue
						const header = core.verified?.header
						const initialAdmin = header?.ruleset?.initialAdmin
						if (agentIdsMatch(initialAdmin, agentId)) return accountId
					} catch (_e) {}
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
				error: `Account ${accountId.slice(0, 12)}... lacks /sync/write capability. Register to enable writes.`,
			}
		}
	}
	return { ok: true }
}

/** Returns account.registries + °maia spark for human/agent to link. Set account.registries; sparks resolved via registries.sparks. */
async function handleSyncRegistry(worker, req) {
	try {
		const registriesId = getRegistriesId(worker.account)
		const registriesContent = await loadCoMap(worker.peer, registriesId, { retries: 2 })
		const sparksId = registriesContent?.get?.('sparks')
		let maiaSparkId = null
		if (sparksId?.startsWith('co_z')) {
			const sparksContent = await loadCoMap(worker.peer, sparksId, { retries: 2 })
			maiaSparkId = sparksContent?.get?.(SYSTEM_SPARK_REGISTRY_KEY)
		}
		return jsonResponse(
			{
				registries: registriesId,
				...(maiaSparkId?.startsWith('co_z') && { '°maia': maiaSparkId }),
			},
			200,
			{},
			req,
		)
	} catch (e) {
		return err(e?.message ?? 'failed to get sync registry', 500, {}, req)
	}
}

// --- Agent handlers ---
async function handleRegister(worker, body, req) {
	const { type, username, accountId, profileId, sparkCoId } = body || {}
	if (type !== 'human' && type !== 'spark' && type !== 'aven')
		return err(
			'type required: human, spark, or aven',
			400,
			{
				validationErrors: [{ field: 'type', message: 'must be human, spark, or aven' }],
			},
			req,
		)
	if ((type === 'human' || type === 'aven') && (!accountId || typeof accountId !== 'string'))
		return err(
			'accountId required for type=human/aven',
			400,
			{
				validationErrors: [{ field: 'accountId', message: 'required' }],
			},
			req,
		)
	if (
		(type === 'human' || type === 'aven') &&
		(!profileId || typeof profileId !== 'string' || !profileId.startsWith('co_z'))
	)
		return err(
			'profileId required for type=human/aven',
			400,
			{
				validationErrors: [{ field: 'profileId', message: 'required (co_z...)' }],
			},
			req,
		)
	if (type === 'spark' && (!sparkCoId || typeof sparkCoId !== 'string'))
		return err(
			'sparkCoId required for type=spark',
			400,
			{
				validationErrors: [{ field: 'sparkCoId', message: 'required' }],
			},
			req,
		)

	const coId = type === 'spark' ? sparkCoId : accountId
	let u =
		username != null && typeof username === 'string' && username.trim() ? username.trim() : null

	const { peer, dataEngine } = worker
	try {
		const registryKey = type === 'human' ? 'humans' : type === 'aven' ? 'avens' : 'sparks'
		const registryId = await getCoIdByPath(peer, getRegistriesId(worker.account), [registryKey], {
			retries: 2,
		})
		const raw = await peer.getRawRecord(registryId)

		if (type === 'human') {
			// Re-auth: accountId already registered — still ensure grants (migrations / pre-grant accounts)
			const existingHumanId = raw?.[accountId]
			if (existingHumanId?.startsWith('co_z')) {
				const existingUsername = raw
					? Object.keys(raw).find((k) => raw[k] === existingHumanId && k !== accountId)
					: null
				const llmExp = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
				await ensureCapabilityGrant(worker, {
					sub: accountId,
					cmd: '/llm/chat',
					pol: [],
					exp: llmExp,
				})
				await ensureCapabilityGrant(worker, {
					sub: accountId,
					cmd: '/sync/write',
					pol: [],
					exp: llmExp,
				})
				return jsonResponse(
					{
						ok: true,
						type: 'human',
						username: existingUsername ?? generateRegistryName(type),
						accountId: coId,
					},
					200,
					{},
					req,
				)
			}
			const existingUsername = raw ? Object.keys(raw).find((k) => raw[k] === coId) : null
			if (!u) u = existingUsername ?? generateRegistryName(type)
			if (raw?.[u] != null && raw[u] !== coId)
				return err(`username "${u}" already registered to different identity`, 409, {}, req)

			// Create Human CoMap (public: everyone reader) and dual-key registry
			const humanSchemaCoId = getRuntimeRef(peer, RUNTIME_REF.OS_HUMAN)
			if (!humanSchemaCoId)
				return err('Human schema not found. Ensure genesis seed has run.', 500, {}, req)

			const guardian = await peer.getMaiaGroup()
			if (!guardian) return err('Guardian not found', 500, {}, req)

			const node = peer.node
			const humanGroup = node.createGroup()
			humanGroup.extend(guardian, 'extend')
			humanGroup.addMember('everyone', 'reader')
			const llmExp = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
			const humanCoMap = humanGroup.createMap(
				{ account: accountId, profile: profileId, llmExp },
				{ $factory: humanSchemaCoId },
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
				return err(r.errors?.map((e) => e.message).join('; ') ?? 'update failed', 500, {}, req)
			await ensureCapabilityGrant(worker, {
				sub: accountId,
				cmd: '/llm/chat',
				pol: [],
				exp: llmExp,
			})
			await ensureCapabilityGrant(worker, {
				sub: accountId,
				cmd: '/sync/write',
				pol: [],
				exp: llmExp,
			})
			return jsonResponse(
				{
					ok: true,
					type: 'human',
					username: u,
					accountId: coId,
				},
				200,
				{},
				req,
			)
		}

		if (type === 'aven') {
			// Re-auth: accountId already registered — return OK
			const existingAvenId = raw?.[accountId]
			if (existingAvenId?.startsWith('co_z')) {
				const existingUsername = raw
					? Object.keys(raw).find((k) => raw[k] === existingAvenId && k !== accountId)
					: null
				return jsonResponse(
					{
						ok: true,
						type: 'aven',
						username: existingUsername ?? generateRegistryName(type),
						accountId: coId,
					},
					200,
					{},
					req,
				)
			}
			const existingUsername = raw ? Object.keys(raw).find((k) => raw[k] === coId) : null
			if (!u) u = existingUsername ?? generateRegistryName(type)
			if (raw?.[u] != null && raw[u] !== coId)
				return err(`username "${u}" already registered to different identity`, 409, {}, req)

			const avenIdentitySchemaCoId = getRuntimeRef(peer, RUNTIME_REF.OS_AVEN_IDENTITY)
			if (!avenIdentitySchemaCoId)
				return err('Aven identity schema not found. Ensure genesis seed has run.', 500, {}, req)

			const guardian = await peer.getMaiaGroup()
			if (!guardian) return err('Guardian not found', 500, {}, req)

			const node = peer.node
			const avenGroup = node.createGroup()
			avenGroup.extend(guardian, 'extend')
			avenGroup.addMember('everyone', 'reader')
			const avenIdentityCoMap = avenGroup.createMap(
				{ account: accountId, profile: profileId },
				{ $factory: avenIdentitySchemaCoId },
			)
			const memberIdToRemove =
				typeof node.getCurrentAccountOrAgentID === 'function'
					? node.getCurrentAccountOrAgentID()
					: (worker.account?.id ?? worker.account?.$jazz?.id)
			try {
				await removeGroupMember(avenGroup, memberIdToRemove)
			} catch (_e) {}

			const registryData = { [u]: avenIdentityCoMap.id, [accountId]: avenIdentityCoMap.id }
			const r = await dataEngine.execute({ op: 'update', id: registryId, data: registryData })
			if (r?.ok === false)
				return err(r.errors?.map((e) => e.message).join('; ') ?? 'update failed', 500, {}, req)
			return jsonResponse(
				{
					ok: true,
					type: 'aven',
					username: u,
					accountId: coId,
				},
				200,
				{},
				req,
			)
		}

		// Spark registration (unchanged)
		if (!u) u = generateRegistryName(type)
		if (raw?.[u] != null && raw[u] !== coId)
			return err(`username "${u}" already registered to different identity`, 409, {}, req)
		const r = await dataEngine.execute({ op: 'update', id: registryId, data: { [u]: coId } })
		if (r?.ok === false)
			return err(r.errors?.map((e) => e.message).join('; ') ?? 'update failed', 500, {}, req)
		return jsonResponse(
			{
				ok: true,
				type,
				username: u,
				accountId: type === 'human' || type === 'aven' ? coId : undefined,
				sparkCoId: type === 'spark' ? coId : undefined,
			},
			200,
			{},
			req,
		)
	} catch (e) {
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
		console.error(OPS_PREFIX.llm, msg, e)
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
		const url = new URL(req.url)

		if (req.method === 'OPTIONS') return handleCORS(req)

		if (url.pathname === '/health') {
			return jsonResponse({ status: 'ok', service: 'sync', ready: !!syncHandler }, 200, {}, req)
		}

		if (url.pathname === '/syncRegistry' && req.method === 'GET') {
			if (!agentWorker) return jsonResponse({ error: 'Initializing', status: 503 }, 503, {}, req)
			return withTimeout(handleSyncRegistry(agentWorker, req), REQUEST_TIMEOUT_MS, '/syncRegistry')
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
		} else if (url.pathname.startsWith('/register') || url.pathname.startsWith('/syncRegistry')) {
			return jsonResponse({ error: 'Initializing', status: 503 }, 503, {}, req)
		}

		// API (LLM)
		if (url.pathname === '/api/v0/llm/chat' && req.method === 'POST') {
			if (!agentWorker) return jsonResponse({ error: 'Initializing', status: 503 }, 503, {}, req)
			return handleLLMChat(req, agentWorker)
		}

		return new Response('Not Found', { status: 404, headers: corsHeadersForRequest(req) })
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
	try {
		if (!accountID || !agentSecret) {
			throw new Error('AVEN_MAIA_ACCOUNT and AVEN_MAIA_SECRET required. Run: bun agent:generate')
		}

		if (dbPath && !process.env.PEER_DB_PATH) process.env.PEER_DB_PATH = dbPath

		const storageLabel = usePostgres ? 'Postgres' : `PGlite at ${dbPath || './pg-lite.db'}`
		opsSync.log('Loading account (%s)...', storageLabel)
		opsSync.log('accountID=%s', `${accountID?.slice(0, 12)}...`)
		if (!RED_PILL_API_KEY) {
			opsSync.warn(
				'RED_PILL_API_KEY not set — LLM chat will return 500. Add to root .env and restart.',
			)
		}

		if (peerSyncSeed) {
			const { clearStorageForReseed } = await import('@MaiaOS/storage/clearStorageForReseed')
			await clearStorageForReseed({ dbPath, usePostgres })
			opsSync.log('Storage cleared for reseed (DB + binary).')
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
		const evaluator = new MaiaScriptEvaluator()
		const dataEngine = new DataEngine(peer, { evaluator })
		peer.dbEngine = dataEngine
		agentWorker = { node: localNode, account: result.account, peer, dataEngine }

		// Ensure migration completes before seed (sparkGuardian -> guardian, registries.humans)
		// loadAccount defers migration; seed needs guardian in os.groups
		await ensureProfileForNewAccount(result.account, localNode)

		if (peerSyncSeed) {
			const { ensureFactoriesLoaded, getAllFactories } = await import(
				'@MaiaOS/factories/factory-registry'
			)
			await ensureFactoriesLoaded()
			const { getAllVibeRegistries } = await import('@MaiaOS/universe')
			const allVibeRegistries = await getAllVibeRegistries()
			const vibeRegistries = await filterVibesForSeeding(allVibeRegistries, seedVibesConfig)
			if (vibeRegistries.length === 0) {
				throw new Error(
					`${OPS_PREFIX.sync} Genesis sync requires vibes. getAllVibeRegistries returned none or SEED_VIBES filtered all.`,
				)
			}
			const { configs: mergedConfigs, data } = await buildSeedConfig(vibeRegistries)
			const {
				actors: serviceActors,
				interfaces: serviceInterfaces,
				inboxes: serviceInboxes,
				contexts: actorContexts,
				views: actorViews,
				processes: actorProcesses,
				styles: actorStyles,
				wasms: serviceWasms,
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
				wasms: { ...(mergedConfigs.wasms || {}), ...(serviceWasms || {}) },
			}
			const schemas = getAllFactories()
			const seedResult = await dataEngine.execute({
				op: 'seed',
				configs: configsForSeed,
				schemas,
				data,
				forceFreshSeed: true,
			})
			if (seedResult?.ok === false && seedResult?.errors?.length) {
				const msg = seedResult.errors.map((e) => e?.message ?? e).join('; ')
				throw new Error(`${OPS_PREFIX.sync} Genesis seed failed: ${msg}`)
			}
			opsSync.log(
				`Genesis seeded: ${vibeRegistries.length} vibe(s) (schemas + scaffold). Set PEER_SYNC_SEED=false for subsequent restarts.`,
			)
		} else {
			opsSync.log('PEER_SYNC_SEED not set — using persisted scaffold (skip seed).')
		}

		await peer.resolveSystemSparkCoId()
		await dataEngine.resolveSystemFactories()

		// Seed /admin for AVEN_MAIA_ACCOUNT (grants all endpoints). Must run after scaffold exists (genesis or prior run).
		await seedAdminCapabilityForServerAccount(agentWorker).catch((e) =>
			opsSync.warn('seedAdminCapabilityForServerAccount:', e?.message),
		)

		await seedCapabilitiesForGuardian(agentWorker).catch((e) =>
			opsSync.warn('seedCapabilitiesForGuardian:', e?.message),
		)

		await ensureCapabilityGrantsForRegisteredHumanAccountKeys(agentWorker).catch((e) =>
			opsRegister.warn('ensureCapabilityGrantsForRegisteredHumanAccountKeys:', e?.message),
		)

		// Self-register Maia aven in registries.avens for profile resolution (idempotent)
		const profileId = result.account.get('profile')
		if (profileId?.startsWith('co_z')) {
			await handleRegister(agentWorker, {
				type: 'aven',
				username: maiaName,
				accountId: accountID,
				profileId,
			}).catch((e) => opsSync.warn('Self-register aven:', e?.message))
		}

		// Add AVEN_MAIA_GUARDIAN as admin of °maia spark guardian group. Retry on each start until success (account may sync after client connects).
		if (avenMaiaGuardian?.startsWith('co_z')) {
			const tryAddGuardian = async () => {
				const guardian = await agentWorker.peer.getMaiaGroup()
				if (!guardian) return false
				await agentWorker.peer.addGroupMember(guardian, avenMaiaGuardian, 'admin')
				return true
			}
			tryAddGuardian()
				.then((ok) => {
					if (ok) opsSync.log('Added guardian as admin of °maia spark.')
				})
				.catch((e) => {
					const msg = e?.message ?? String(e)
					const waitingForSync =
						msg.includes('Timeout waiting for CoValue') || msg.includes('not available')
					if (waitingForSync) {
						opsSync.log(
							'Guardian admin pending: guardian account not in server storage yet (connect app once); retrying every 15s.',
						)
					} else {
						opsSync.warn('Guardian add deferred (will retry):', msg)
					}
					const retryMs = 15000
					const id = setInterval(async () => {
						try {
							const ok = await tryAddGuardian()
							if (ok) {
								clearInterval(id)
								opsSync.log('Added guardian as admin of °maia spark.')
							}
						} catch (err) {
							const msg = err?.message ?? ''
							if (msg.includes('already') || msg.includes('member')) {
								clearInterval(id)
							}
						}
					}, retryMs)
				})
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
		opsSync.log('Ready')
	} catch (e) {
		opsSync.error('Init failed:', e?.message ?? e)
		if (e?.stack) console.error(e.stack)
		process.exit(1)
	}
})()
