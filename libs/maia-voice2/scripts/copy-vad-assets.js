#!/usr/bin/env bun
/**
 * Copy VAD + ONNX Runtime assets to public/vad/ for local serving.
 * VAD is loaded via script tags (avoids Vite dynamic require of onnxruntime-web/wasm).
 */

import { cp, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const VAD_SRC = join(ROOT, 'node_modules/@ricky0123/vad-web/dist')
const ORT_SRC = join(ROOT, 'node_modules/onnxruntime-web/dist')
const DST = join(ROOT, 'public/vad')

const VAD_FILES = [
	'vad.worklet.bundle.min.js',
	'bundle.min.js',
	'silero_vad_legacy.onnx',
	'silero_vad_v5.onnx',
]

const ORT_FILES = ['ort.wasm.min.js', 'ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']

async function main() {
	await mkdir(DST, { recursive: true })
	for (const file of VAD_FILES) {
		const src = join(VAD_SRC, file)
		const dst = join(DST, file)
		await cp(src, dst, { force: true })
		console.log(`Copied ${file} -> public/vad/`)
	}
	for (const file of ORT_FILES) {
		const src = join(ORT_SRC, file)
		const dst = join(DST, file)
		await cp(src, dst, { force: true })
		console.log(`Copied ${file} -> public/vad/`)
	}
	console.log('VAD + ONNX Runtime assets copied to public/vad/')
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
