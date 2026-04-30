import { verifyInvocationToken } from '@MaiaOS/aven-os/server'

/** LLM messages schema: role + optional content. Enforces structure and limits. */
const LLM_MAX_MESSAGES = 100
const LLM_MAX_CONTENT_LENGTH = 200_000
const LLM_ALLOWED_ROLES = new Set(['system', 'user', 'assistant'])

export function validateLLMMessages(messages) {
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

/**
 * LLM proxy: forwards request to RedPill.
 */
export async function handleLLMChat(
	{ jsonResponse, verifyAccountBinding, hasValidCapability, redPillApiKey, opsLlm },
	req,
	worker,
) {
	if (!redPillApiKey) return jsonResponse({ error: 'RED_PILL_API_KEY not configured' }, 500, {}, req)
	if (!worker) return jsonResponse({ error: 'Initializing', status: 503 }, 503, {}, req)

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
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${redPillApiKey}` },
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
