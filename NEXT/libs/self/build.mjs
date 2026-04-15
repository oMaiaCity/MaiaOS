import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = import.meta.dir
const outdir = join(root, 'dist')
await mkdir(outdir, { recursive: true })

const result = await Bun.build({
	entrypoints: [join(root, 'src', 'index.js')],
	outdir,
	target: 'browser',
	format: 'esm',
	naming: 'self.mjs',
	sourcemap: 'external',
	minify: false,
})

if (!result.success) {
	console.error(result.logs)
	process.exit(1)
}

console.log('ok', join(outdir, 'self.mjs'))
