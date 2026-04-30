import {
	createInboundSmtpServer,
	createInMemoryMailStore,
	ingestRfc822,
	listMessageSummaries,
	parseRfc822ForView,
} from '@MaiaOS/mail'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * @param {string | undefined} raw
 * @returns {string[]}
 */
function parseCommaAddresses(raw) {
	if (raw === undefined || raw === null) return []
	const t = String(raw).trim()
	if (!t) return []
	return t
		.split(',')
		.map((x) => x.trim().toLowerCase())
		.filter(Boolean)
}

/**
 * @param {string | undefined} raw
 * @param {number} fallback
 * @returns {number}
 */
function parsePositiveInt(raw, fallback) {
	const n = Number(raw)
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

/**
 * @typedef {{
 *   httpPort: number
 *   smtpPort: number
 *   hostedDomains: string[]
 *   ingestToken: string
 *   maxBytes: number
 *   allowedRcpts?: string[]
 *   whitelistedMails?: string[]
 *   smtpMaxClients?: number
 *   smtpSocketTimeoutMs?: number
 *   smtpMaxConcurrentPerIp?: number
 *   smtpMaxMailFromPerIpPerWindow?: number
 *   smtpRateWindowMs?: number
 *   publicDir?: string
 *   smtpHost?: string
 *   key?: Buffer
 *   cert?: Buffer
 * }} AvenConfig
 */

/**
 * @param {AvenConfig} config
 */
export async function startAven(config) {
	const publicDir = config.publicDir ?? join(__dirname, '..', 'public')
	const store = createInMemoryMailStore()
	const inbound = createInboundSmtpServer({
		store,
		hostedDomains: config.hostedDomains,
		port: config.smtpPort,
		host: config.smtpHost ?? '0.0.0.0',
		maxBytes: config.maxBytes,
		allowedRcpts: config.allowedRcpts,
		whitelistedMails: config.whitelistedMails,
		smtpMaxClients: config.smtpMaxClients,
		smtpSocketTimeoutMs: config.smtpSocketTimeoutMs,
		smtpMaxConcurrentPerIp: config.smtpMaxConcurrentPerIp,
		smtpMaxMailFromPerIpPerWindow: config.smtpMaxMailFromPerIpPerWindow,
		smtpRateWindowMs: config.smtpRateWindowMs,
		...(config.key && config.cert ? { key: config.key, cert: config.cert } : {}),
	})
	const smtpInfo = await inbound.listen()

	/**
	 * @param {Request} req
	 */
	function fetchHandler(req) {
		const url = new URL(req.url)
		if (req.method === 'GET' && url.pathname === '/health') {
			return new Response('ok\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } })
		}
		if (req.method === 'GET' && url.pathname === '/api/inbox') {
			const list = listMessageSummaries(store)
			return Response.json(list)
		}
		if (req.method === 'GET' && url.pathname.startsWith('/api/inbox/')) {
			const suffix = url.pathname.slice('/api/inbox/'.length)
			const segments = suffix.split('/').filter(Boolean)
			const id = segments[0]
			const row = store._rows.find((r) => r.id === id)
			if (!row) {
				return new Response('Not found', { status: 404 })
			}
			if (segments.length === 1) {
				const detail = parseRfc822ForView(row.raw)
				return Response.json({
					id: row.id,
					subject: row.subject,
					from: row.from,
					receivedAt: row.receivedAt,
					bodyText: detail.plainText,
					attachments: detail.attachments.map((a, index) => ({
						index,
						filename: a.filename,
						contentType: a.contentType,
						inlinePdf: a.inlinePdf,
					})),
				})
			}
			if (segments[1] === 'attachment' && segments[2] !== undefined) {
				const idx = Number(segments[2])
				if (!Number.isInteger(idx) || idx < 0) {
					return new Response('Bad request', { status: 400 })
				}
				const detail = parseRfc822ForView(row.raw)
				const att = detail.attachments[idx]
				if (!att) {
					return new Response('Not found', { status: 404 })
				}
				const safeName = att.filename.replace(/[\r\n"]/g, '_')
				return new Response(att.data, {
					headers: {
						'content-type': att.contentType,
						'content-disposition': `inline; filename="${safeName}"`,
						'cache-control': 'private',
					},
				})
			}
			return new Response('Not found', { status: 404 })
		}
		if (req.method === 'POST' && url.pathname === '/ingest') {
			const token = config.ingestToken
			if (!token) {
				return new Response('ingest disabled: set AVEN_INGEST_TOKEN', { status: 503 })
			}
			const auth = req.headers.get('authorization')
			if (!auth || auth !== `Bearer ${token}`) {
				return new Response('Unauthorized', { status: 401 })
			}
			return req.arrayBuffer().then((body) => {
				ingestRfc822(store, new Uint8Array(body))
				return Response.json({ ok: true })
			})
		}
		if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
			const html = readFileSync(join(publicDir, 'index.html'), 'utf8')
			return new Response(html, {
				headers: { 'content-type': 'text/html; charset=utf-8' },
			})
		}
		return new Response('Not found', { status: 404 })
	}

	const http = Bun.serve({
		port: config.httpPort,
		fetch: fetchHandler,
	})

	return {
		store,
		inbound,
		http,
		smtpPort: smtpInfo.port,
		async stop() {
			http.stop()
			await inbound.close()
		},
	}
}

/**
 * @returns {AvenConfig}
 */
export function avenConfigFromEnv() {
	const httpPort = Number(process.env.AVEN_HTTP_PORT ?? process.env.PORT ?? 4202)
	const smtpPort = Number(process.env.AVEN_SMTP_PORT ?? 2525)
	const hostedDomains = String(process.env.AVEN_HOSTED_DOMAINS ?? 'localhost')
		.split(',')
		.map((x) => x.trim())
		.filter(Boolean)
	const ingestToken = String(process.env.AVEN_INGEST_TOKEN ?? '').trim()
	const maxBytes = Number(process.env.AVEN_MAX_MESSAGE_BYTES ?? 2_097_152)
	const allowedRcpts = parseCommaAddresses(process.env.AVEN_ALLOWED_RCPTS)
	const whitelistedMails = parseCommaAddresses(process.env.AVEN_WHITELISTED_MAILS)
	const smtpMaxClients = parsePositiveInt(process.env.AVEN_SMTP_MAX_CLIENTS, 64)
	const smtpSocketTimeoutMs = parsePositiveInt(process.env.AVEN_SMTP_SOCKET_TIMEOUT_MS, 120_000)
	const smtpMaxConcurrentPerIp = parsePositiveInt(process.env.AVEN_SMTP_MAX_CONCURRENT_PER_IP, 8)
	const smtpMaxMailFromPerIpPerWindow = parsePositiveInt(
		process.env.AVEN_SMTP_MAX_MAIL_FROM_PER_IP_PER_WINDOW,
		60,
	)
	const smtpRateWindowMs = parsePositiveInt(process.env.AVEN_SMTP_RATE_WINDOW_MS, 60_000)
	let key
	let cert
	if (process.env.AVEN_TLS_KEY_PATH && process.env.AVEN_TLS_CERT_PATH) {
		key = readFileSync(process.env.AVEN_TLS_KEY_PATH)
		cert = readFileSync(process.env.AVEN_TLS_CERT_PATH)
	}
	return {
		httpPort,
		smtpPort,
		hostedDomains,
		ingestToken,
		maxBytes,
		allowedRcpts,
		whitelistedMails,
		smtpMaxClients,
		smtpSocketTimeoutMs,
		smtpMaxConcurrentPerIp,
		smtpMaxMailFromPerIpPerWindow,
		smtpRateWindowMs,
		...(key && cert ? { key, cert } : {}),
	}
}
