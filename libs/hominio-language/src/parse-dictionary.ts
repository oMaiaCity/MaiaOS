/**
 * Parser for dictionary.xml file
 * Converts XML data to JSON format, grouped by type
 */

// Bun global is available in Bun runtime
declare const Bun: {
	file(path: string | URL): {
		text(): Promise<string>
	}
}

export interface DictionaryEntry {
	word: string
	type: string
	definition: string
}

/**
 * Parses the dictionary.xml file and converts it to JSON format grouped by type
 */
export async function parseDictionaryXml(xmlPath: string | URL): Promise<Map<string, DictionaryEntry[]>> {
	// Use Bun's built-in file reading
	const fileContent = await Bun.file(xmlPath).text()
	
	// Map to store entries grouped by type
	const entriesByType = new Map<string, DictionaryEntry[]>()
	
	// Regex to match valsi entries
	// Format: <valsi word="..." type="..."><definition>...</definition>...</valsi>
	// We need to handle:
	// - word attribute
	// - type attribute
	// - definition element (may contain nested XML entities like &apos;)
	// - Ignore selmaho and rafsi elements
	
	const valsiPattern = /<valsi\s+word="([^"]*)"\s+type="([^"]*)"[^>]*>(.*?)<\/valsi>/gs
	
	let match
	while ((match = valsiPattern.exec(fileContent)) !== null) {
		const word = match[1]
		const type = match[2]
		const innerContent = match[3]
		
		// Extract definition - it's between <definition> and </definition>
		// May contain nested tags or entities, so we need to handle that
		const definitionMatch = innerContent.match(/<definition>(.*?)<\/definition>/s)
		if (!definitionMatch) {
			// Skip entries without definition
			continue
		}
		
		let definition = definitionMatch[1]
		
		// Decode XML entities
		definition = definition
			.replace(/&apos;/g, "'")
			.replace(/&quot;/g, '"')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
		
		// Clean up any remaining XML tags (like notes, etc.)
		definition = definition.replace(/<[^>]*>/g, '').trim()
		
		const entry: DictionaryEntry = {
			word,
			type,
			definition,
		}
		
		// Add to the appropriate type group
		if (!entriesByType.has(type)) {
			entriesByType.set(type, [])
		}
		entriesByType.get(type)!.push(entry)
	}
	
	return entriesByType
}

/**
 * Main function to parse and export dictionary data
 */
export async function getDictionaryData(): Promise<Map<string, DictionaryEntry[]>> {
	// Use import.meta.url to resolve the XML file path relative to this module
	const currentFileUrl = import.meta.url
	const xmlUrl = new URL('dictionary.xml', currentFileUrl)
	return parseDictionaryXml(xmlUrl)
}

