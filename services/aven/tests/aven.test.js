import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { once } from 'node:events'
import net from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startAven } from '../src/server.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

/**
 * @param {net.Socket} sock
 * @param {string} buf
 */
async function fillBuffer(sock, buf) {
	let b = buf
	while (true) {
		const i = b.indexOf('\r\n')
		if (i !== -1) return { line: b.slice(0, i), rest: b.slice(i + 2) }
		const [chunk] = await once(sock, 'data')
		b += chunk.toString('latin1')
	}
}

/**
 * @param {net.Socket} sock
 * @param {string} buf
 */
async function readSmtpResponse(sock, buf) {
	let b = buf
	/** @type {string[]} */
	const lines = []
	while (true) {
		const { line, rest } = await fillBuffer(sock, b)
		b = rest
		lines.push(line)
		if (line.length >= 4 && line[3] === ' ') break
		if (line.length >= 4 && line[3] !== '-') throw new Error(`Bad SMTP line: ${line}`)
	}
	return { lines, buf: b }
}

/**
 * @param {net.Socket} sock
 */
async function smtpDeliverToAven(sock) {
	let buf = ''
	let r = await readSmtpResponse(sock, buf)
	buf = r.buf
	expect(r.lines[0].startsWith('220')).toBe(true)
	sock.write('EHLO tester\r\n')
	r = await readSmtpResponse(sock, buf)
	buf = r.buf
	sock.write('MAIL FROM:<sender@remote.example>\r\n')
	r = await readSmtpResponse(sock, buf)
	buf = r.buf
	sock.write('RCPT TO:<in@example.com>\r\n')
	r = await readSmtpResponse(sock, buf)
	buf = r.buf
	sock.write('DATA\r\n')
	r = await readSmtpResponse(sock, buf)
	buf = r.buf
	const msg =
		'Subject: Via Aven SMTP\r\nFrom: s@r.x\r\nDate: Wed, 1 Jan 2025 00:00:00 +0000\r\n\r\nbody\r\n'
	sock.write(`${msg}\r\n.\r\n`)
	r = await readSmtpResponse(sock, buf)
	expect(r.lines[0].startsWith('250')).toBe(true)
	sock.write('QUIT\r\n')
	sock.end()
}

const tinyPdfB64 =
	'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94W0AgMCAzIDNdPj4KZW5kb2JqCnhyZWYKMCAKdHJhaWxlcgo8PC9TaXplIDQ+PgolJUVPRgo='

/**
 * @param {net.Socket} sock
 */
async function smtpDeliverPdfToAven(sock) {
	let buf = ''
	let r = await readSmtpResponse(sock, buf)
	buf = r.buf
	expect(r.lines[0].startsWith('220')).toBe(true)
	sock.write('EHLO tester\r\n')
	r = await readSmtpResponse(sock, buf)
	buf = r.buf
	sock.write('MAIL FROM:<sender@remote.example>\r\n')
	r = await readSmtpResponse(sock, buf)
	buf = r.buf
	sock.write('RCPT TO:<in@example.com>\r\n')
	r = await readSmtpResponse(sock, buf)
	buf = r.buf
	sock.write('DATA\r\n')
	r = await readSmtpResponse(sock, buf)
	buf = r.buf
	const msg = [
		'Subject: Aven PDF',
		'From: s@r.x',
		'Date: Wed, 1 Jan 2025 00:00:00 +0000',
		'MIME-Version: 1.0',
		'Content-Type: multipart/mixed; boundary="avb"',
		'',
		'--avb',
		'Content-Type: text/plain',
		'',
		'body',
		'--avb',
		'Content-Type: application/pdf',
		'Content-Disposition: attachment; filename="aven-note.pdf"',
		'Content-Transfer-Encoding: base64',
		'',
		tinyPdfB64,
		'--avb--',
	].join('\r\n')
	sock.write(`${msg}\r\n.\r\n`)
	r = await readSmtpResponse(sock, buf)
	expect(r.lines[0].startsWith('250')).toBe(true)
	sock.write('QUIT\r\n')
	sock.end()
}

describe('@MaiaOS/aven', () => {
	/** @type {Awaited<ReturnType<typeof startAven>>} */
	let runtime
	/** @type {string} */
	let base

	beforeAll(async () => {
		runtime = await startAven({
			httpPort: 0,
			smtpPort: 0,
			smtpHost: '127.0.0.1',
			hostedDomains: ['example.com'],
			ingestToken: 'aven-test-ingest',
			maxBytes: 100_000,
			publicDir,
		})
		base = `http://127.0.0.1:${runtime.http.port}`
	})

	afterAll(async () => {
		await runtime.stop()
	})

	test('GET /health', async () => {
		const res = await fetch(`${base}/health`)
		expect(res.ok).toBe(true)
		expect(await res.text()).toContain('ok')
	})

	test('POST /ingest requires bearer', async () => {
		const bad = await fetch(`${base}/ingest`, { method: 'POST', body: 'x' })
		expect(bad.status).toBe(401)
		const ok = await fetch(`${base}/ingest`, {
			method: 'POST',
			headers: { authorization: 'Bearer aven-test-ingest' },
			body: 'Subject: A\r\nFrom: x@y.z\r\n\r\nb',
		})
		expect(ok.ok).toBe(true)
		const rows = await (await fetch(`${base}/api/inbox`)).json()
		expect(rows.some((m) => m.subject === 'A')).toBe(true)
	})

	test('SMTP delivery surfaces in /api/inbox', async () => {
		const sock = net.createConnection({ port: runtime.smtpPort, host: '127.0.0.1' })
		await once(sock, 'connect')
		await smtpDeliverToAven(sock)
		const rows = await (await fetch(`${base}/api/inbox`)).json()
		expect(rows.some((m) => m.subject === 'Via Aven SMTP')).toBe(true)
	})

	test('SMTP with PDF attachment lists filenames in /api/inbox', async () => {
		const sock = net.createConnection({ port: runtime.smtpPort, host: '127.0.0.1' })
		await once(sock, 'connect')
		await smtpDeliverPdfToAven(sock)
		const rows = await (await fetch(`${base}/api/inbox`)).json()
		const row = rows.find((m) => m.subject === 'Aven PDF')
		expect(row).toBeDefined()
		expect(row.attachments).toEqual(['aven-note.pdf'])
	})

	test('GET / serves HTML', async () => {
		const res = await fetch(base)
		expect(res.ok).toBe(true)
		const t = await res.text()
		expect(t).toContain('Inbound mail')
	})

	test('GET /api/inbox/:id returns body and attachment index; PDF bytes from attachment route', async () => {
		const sock = net.createConnection({ port: runtime.smtpPort, host: '127.0.0.1' })
		await once(sock, 'connect')
		await smtpDeliverPdfToAven(sock)
		const rows = await (await fetch(`${base}/api/inbox`)).json()
		const row = rows.find((m) => m.subject === 'Aven PDF')
		expect(row).toBeDefined()
		const detail = await (await fetch(`${base}/api/inbox/${row.id}`)).json()
		expect(detail.bodyText).toContain('body')
		expect(detail.attachments.length).toBe(1)
		expect(detail.attachments[0].filename).toBe('aven-note.pdf')
		const bin = await fetch(`${base}/api/inbox/${row.id}/attachment/0`)
		expect(bin.ok).toBe(true)
		expect(bin.headers.get('content-type')).toContain('pdf')
		const u8 = new Uint8Array(await bin.arrayBuffer())
		expect(String.fromCharCode(u8[0], u8[1], u8[2], u8[3])).toBe('%PDF')
	})
})
