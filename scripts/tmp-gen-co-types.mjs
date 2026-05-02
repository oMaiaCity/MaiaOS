import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { writeFile } from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FACTORIES = join(__dirname, '../libs/universe/src/avens/maia/seed/factories')

const coTypesPath = join(FACTORIES, 'co-types.defs.json')
const metaFactoryPath = join(FACTORIES, 'meta.factory.json')

const CO_TYPES_DEFS = JSON.parse(await readFile(coTypesPath, 'utf8'))
const metaFactorySchemaRaw = JSON.parse(await readFile(metaFactoryPath, 'utf8'))

const co = `/** From libs/universe/src/avens/maia/seed/factories/co-types.defs.json */
export const CO_TYPES_DEFS = ${JSON.stringify(CO_TYPES_DEFS, null, '\t')}
`
const meta = `/** From libs/universe/src/avens/maia/seed/factories/meta.factory.json */
export const metaFactorySchemaRaw = ${JSON.stringify(metaFactorySchemaRaw, null, '\t')}
`
await writeFile(new URL('../libs/universe/src/avens/maia/helpers/co-types.js', import.meta.url), co)
await writeFile(new URL('../libs/universe/src/avens/maia/helpers/meta-factory-schema-raw.js', import.meta.url), meta)
