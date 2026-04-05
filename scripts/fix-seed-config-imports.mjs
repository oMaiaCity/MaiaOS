import fs from 'node:fs'

const p = 'libs/maia-actors/src/maia/seed-config.js'
const full = fs.readFileSync(p, 'utf8')
const restIdx = full.indexOf('/** Resolve actor ref')
if (restIdx < 0) throw new Error('marker not found')
const rest = full.slice(restIdx)
const lines = full.slice(0, restIdx).split('\n')
const rawImports = []
const assigns = []
for (const line of lines) {
	const m = line.match(/^import (\w+)Raw from '(\.\/[^']+\.maia)'$/)
	if (m) {
		const rel = m[2].replace(/^\.\//, '')
		rawImports.push(`import ${m[1]}Raw from './${rel}'`)
		assigns.push(`const ${m[1]} = annotateMaiaConfig(${m[1]}Raw, '${rel}')`)
	}
}
const header = `/**
 * Seed config for service actors - contributes actors to genesis seed.
 * Merged by the sync server into buildSeedConfig output; replaces separate tool config.
 * Also includes standalone UI actors (e.g. placeholder).
 */

import { deriveInboxId } from '@MaiaOS/factories/seeding-utils'
import { annotateMaiaConfig } from '@MaiaOS/factories/annotate-maia'

${rawImports.join('\n')}

${assigns.join('\n')}

`
fs.writeFileSync(p, `${header}\n${rest}`)
console.log('fixed', rawImports.length, 'imports')
