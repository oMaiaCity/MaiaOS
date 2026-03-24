#!/usr/bin/env bun
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const distDir = join(__dirname, 'dist')

if (existsSync(distDir)) {
	rmSync(distDir, { recursive: true })
}
mkdirSync(distDir, { recursive: true })

const result = await Bun.build({
	entrypoints: [join(__dirname, 'main.js')],
	outdir: distDir,
	naming: { entry: 'main.[ext]' },
	target: 'browser',
	format: 'esm',
	minify: true,
})

if (!result.success) {
	console.error(result.logs)
	process.exit(1)
}

cpSync(join(__dirname, 'index.html'), join(distDir, 'index.html'))
cpSync(join(__dirname, 'style.css'), join(distDir, 'style.css'))
