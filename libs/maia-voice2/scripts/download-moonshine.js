#!/usr/bin/env bun
/**
 * Pre-download Moonshine Streaming medium (~530 MB) from HuggingFace.
 * Run: bun run scripts/download-moonshine.js
 *
 * Saves to public/Moonshine-Streaming-medium/ so the app loads locally.
 */

import { createWriteStream } from 'node:fs'
import { mkdir, stat, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'Moonshine-Streaming-medium')
const BASE_URL = 'https://huggingface.co/UsefulSensors/moonshine-streaming/resolve/main/onnx/medium'

const FILES = [
	'streaming_config.json',
	'tokenizer.json',
	'frontend.onnx',
	'encoder.onnx',
	'adapter.onnx',
	'cross_kv.onnx',
	'decoder.onnx',
	'decoder_kv.onnx',
]

function formatMb(bytes) {
	return (bytes / 1024 / 1024).toFixed(1)
}

async function getRemoteSize(url) {
	const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
	if (!res.ok) return null
	const contentLength = res.headers.get('content-length')
	return contentLength ? Number.parseInt(contentLength, 10) : null
}

async function canSkipDownload(outPath, url) {
	try {
		const [st, remoteSize] = await Promise.all([stat(outPath), getRemoteSize(url)])
		if (!st.isFile() || remoteSize == null || st.size !== remoteSize) return null
		return st
	} catch {
		return null
	}
}

const PROGRESS_INTERVAL_MS = 250

async function downloadWithProgress(url, outPath, onProgress) {
	let existingSize = 0
	try {
		const st = await stat(outPath)
		if (st.isFile() && st.size > 0) existingSize = st.size
	} catch {
		/* no partial file */
	}

	const remoteSize = await getRemoteSize(url)
	const total = remoteSize ?? null
	const startByte = existingSize
	const headers = startByte > 0 && remoteSize != null ? { Range: `bytes=${startByte}-` } : undefined

	const res = await fetch(url, { redirect: 'follow', headers })
	if (!res.ok) {
		throw new Error(`HTTP ${res.status}: ${url}`)
	}
	if (startByte > 0 && res.status !== 206) {
		await res.body?.cancel?.()
		await unlink(outPath)
		return downloadWithProgress(url, outPath, onProgress)
	}

	const writer = createWriteStream(outPath, startByte > 0 ? { flags: 'a' } : {})
	const reader = res.body.getReader()
	let received = startByte
	let lastProgressTime = 0

	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			const ok = writer.write(value)
			if (!ok) {
				await new Promise((r) => writer.once('drain', r))
			}
			received += value.byteLength
			const now = Date.now()
			if (now - lastProgressTime >= PROGRESS_INTERVAL_MS) {
				lastProgressTime = now
				onProgress(received, total ?? received)
			}
		}
		writer.end()
		await new Promise((resolve, reject) => {
			writer.on('finish', resolve)
			writer.on('error', reject)
		})
	} finally {
		reader.releaseLock()
	}

	onProgress(received, total)
	return received
}

async function main() {
	console.log('Moonshine Streaming medium pre-download')
	console.log('Target:', OUT)
	console.log('')

	for (let i = 0; i < FILES.length; i++) {
		const file = FILES[i]
		const url = `${BASE_URL}/${file}`
		const outPath = join(OUT, file)
		const prefix = `[${i + 1}/${FILES.length}] ${file} ... `

		try {
			await mkdir(dirname(outPath), { recursive: true })

			const skipped = await canSkipDownload(outPath, url)
			if (skipped) {
				const mb = formatMb(skipped.size)
				console.log(`${prefix}${mb} MB (skipped, integrity ok)`)
				continue
			}

			const partial = await stat(outPath)
				.then((s) => s.size)
				.catch(() => 0)
			if (partial > 0) {
				console.log(`${prefix}resuming from ${formatMb(partial)} MB ...`)
			}

			const written = await downloadWithProgress(url, outPath, (received, total) => {
				const receivedMb = formatMb(received)
				if (total != null && total > 0) {
					const totalMb = formatMb(total)
					const pct = Math.round((received / total) * 100)
					process.stdout.write(`\r${prefix}${receivedMb} MB / ${totalMb} MB (${pct}%)`)
				} else {
					process.stdout.write(`\r${prefix}${receivedMb} MB downloaded`)
				}
			})

			const mb = formatMb(written)
			process.stdout.write(`\r${prefix}${mb} MB\n`)
		} catch (err) {
			process.stdout.write('\n')
			console.error(err.message)
			process.exit(1)
		}
	}

	console.log('')
	console.log('Done. Model saved to public/Moonshine-Streaming-medium/')
	console.log('Run `bun run dev` to use the local model.')
}

main()
