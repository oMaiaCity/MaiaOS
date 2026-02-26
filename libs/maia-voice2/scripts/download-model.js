#!/usr/bin/env bun
/**
 * Pre-download LFM2.5-Audio-1.5B-ONNX Q4 variant (ASR only, ~1.1GB) from HuggingFace.
 * Run: bun run scripts/download-model.js
 *
 * Saves to public/LFM2.5-Audio-1.5B-ONNX/ so the app loads locally instead of on-the-fly.
 */

import { createWriteStream } from 'node:fs'
import { mkdir, stat, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'LFM2.5-Audio-1.5B-ONNX')
const BASE_URL = 'https://huggingface.co/LiquidAI/LFM2.5-Audio-1.5B-ONNX/resolve/main'

// ASR only: decoder, audio_encoder, embed_tokens, tokenizer, mel_config
const FILES = [
	'config.json',
	'tokenizer.json',
	'tokenizer_config.json',
	'onnx/mel_config.json',
	'onnx/embed_tokens.json',
	'onnx/embed_tokens.bin',
	'onnx/decoder_q4.onnx',
	'onnx/decoder_q4.onnx_data',
	'onnx/audio_encoder_q4.onnx',
	'onnx/audio_encoder_q4.onnx_data',
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

/** Returns stat if local file exists and size matches remote; null otherwise. */
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

/** Stream download to disk (low memory, avoids OOM). Supports resume via Range. */
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
	// 206 = Partial Content when using Range. If server returns 200, retry from scratch.
	if (startByte > 0 && res.status !== 206) {
		await res.body?.cancel?.()
		await unlink(outPath)
		return downloadWithProgress(url, outPath, onProgress)
	}
	const contentLength = res.headers.get('content-length')
	const expectedBytes = contentLength ? Number.parseInt(contentLength, 10) : null

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
				onProgress(received, total ?? received + (expectedBytes ?? 0))
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
	console.log('LFM2.5-Audio Q4 ASR model pre-download')
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
	console.log('Done. Model saved to public/LFM2.5-Audio-1.5B-ONNX/')
	console.log('Run `bun run dev` to use the local model.')
}

main()
