/**
 * Script to generate dictionary JSON files from dictionary.xml
 * Creates separate JSON files for each word type
 * Run with: bun src/generate-dictionary-json.ts
 */

import { getDictionaryData } from './parse-dictionary'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
	console.log('Parsing dictionary.xml...')
	const entriesByType = await getDictionaryData()
	
	// Create dictionary subfolder
	const dictionaryDir = join(__dirname, 'dictionary')
	mkdirSync(dictionaryDir, { recursive: true })
	
	console.log(`Found ${entriesByType.size} different types:`)
	
	// Write a JSON file for each type in the dictionary subfolder
	for (const [type, entries] of entriesByType.entries()) {
		console.log(`  - ${type}: ${entries.length} entries`)
		
		// Sanitize type name for filename (replace special characters)
		const sanitizedType = type.replace(/[^a-zA-Z0-9]/g, '_')
		const outputPath = join(dictionaryDir, `${sanitizedType}.json`)
		
		writeFileSync(outputPath, JSON.stringify(entries, null, 2), 'utf-8')
		console.log(`    ✅ Generated ${outputPath}`)
	}
	
	// Show sample entry
	const firstType = entriesByType.keys().next().value
	if (firstType && entriesByType.get(firstType)?.length) {
		console.log(`\nSample entry:`, JSON.stringify(entriesByType.get(firstType)![0], null, 2))
	}
}

main().catch(console.error)

