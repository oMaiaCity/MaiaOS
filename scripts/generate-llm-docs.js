#!/usr/bin/env bun
/**
 * Auto-generate LLM-friendly documentation
 * Combines multiple .md files into single context-optimized files
 *
 * Output:
 * - libs/maia-docs/04_agents/LLM_Creators.md (ARCHITECTURE + creators docs)
 * - libs/maia-docs/04_agents/LLM_Developers.md (ARCHITECTURE + developers docs)
 * - libs/maia-docs/04_agents/LLM_maia-self.md (package-specific: 01_maia-self)
 * - libs/maia-docs/04_agents/LLM_maia-core.md (package-specific: 02_maia-core)
 * - libs/maia-docs/04_agents/LLM_maia-schemata.md (package-specific: 03_maia-schemata)
 * - libs/maia-docs/04_agents/LLM_maia-script.md (package-specific: 04_maia-script)
 * - libs/maia-docs/04_agents/LLM_maia-db.md (package-specific: 05_maia-db)
 *
 * Reads from: libs/maia-docs/ (getting-started, creators, developers)
 * Writes to: libs/maia-docs/04_agents/ (LLM documentation files)
 *
 * Supports nested directory structures (recursive reading)
 *
 * Runs on file changes in watch mode
 */

import { watch } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DOCS_DIR = join(__dirname, '../libs/maia-docs')
const OUTPUT_AGENTS_DIR = join(DOCS_DIR, '04_agents')
const GETTING_STARTED_DIR = join(DOCS_DIR, '01_getting-started')

/**
 * Read all markdown files from a directory recursively
 */
async function readMarkdownFiles(dir, baseDir = dir) {
	try {
		const entries = await readdir(dir, { withFileTypes: true })
		const contents = []

		for (const entry of entries) {
			const fullPath = join(dir, entry.name)

			if (entry.isDirectory()) {
				// Recursively read subdirectories
				const subContents = await readMarkdownFiles(fullPath, baseDir)
				contents.push(...subContents)
			} else if (entry.isFile() && entry.name.endsWith('.md')) {
				// Read markdown file
				const content = await readFile(fullPath, 'utf-8')
				const relativePath = relative(baseDir, fullPath)
				contents.push({
					file: entry.name,
					path: relativePath,
					content: content.trim(),
				})
			}
		}

		// Sort by path to maintain order (01_maia-self, 02_maia-core, etc.)
		return contents.sort((a, b) => a.path.localeCompare(b.path))
	} catch (_error) {
		return []
	}
}

/**
 * Generate LLM documentation file
 */
async function generateLLMDoc(type, sections) {
	const timestamp = new Date().toISOString()

	let output = `# MaiaOS Documentation for ${type}\n\n`
	output += `**Auto-generated:** ${timestamp}\n`
	output += `**Purpose:** Complete context for LLM agents working with MaiaOS\n\n`
	output += `---\n\n`

	// Add each section
	for (const section of sections) {
		output += `# ${section.title}\n\n`
		if (section.source) {
			output += `*Source: ${section.source}*\n\n`
		}
		output += `${section.content}\n\n`
		output += `---\n\n`
	}

	return output
}

/**
 * Extract package name from directory path
 * e.g., "01_maia-self" -> "maia-self"
 */
function extractPackageName(dirName) {
	return dirName.replace(/^\d+_/, '')
}

/**
 * Generate package-specific LLM documentation
 */
async function generatePackageDoc(packageDir, packageName) {
	const packageDocs = await readMarkdownFiles(packageDir)

	if (packageDocs.length === 0) {
		// Skip silently - no need to log
		return
	}

	const sections = packageDocs.map((doc) => {
		const fileName = doc.file.replace('.md', '').replace(/^\d+_/, '')
		const title = fileName.replace(/-/g, ' ').toUpperCase()

		return {
			title,
			source: `developers/${doc.path || doc.file}`,
			content: doc.content,
		}
	})

	const packageLLM = await generateLLMDoc(packageName, sections)
	const outputFile = join(OUTPUT_AGENTS_DIR, `LLM_${packageName}.md`)
	await writeFile(outputFile, packageLLM, 'utf-8')
	// Individual file logs removed - only show summary at end
}

/**
 * Main generation function
 */
async function generate() {
	// Ensure agents directory exists
	await mkdir(OUTPUT_AGENTS_DIR, { recursive: true })

	// Read getting-started docs (prefix for both)
	const gettingStartedDocs = await readMarkdownFiles(GETTING_STARTED_DIR)

	// Read creators docs
	const creatorDocs = await readMarkdownFiles(join(DOCS_DIR, '02_creators'))

	// Read developers docs
	const developerDocs = await readMarkdownFiles(join(DOCS_DIR, '03_developers'))

	// Generate Creator LLM doc
	const creatorSections = [
		...gettingStartedDocs.map((doc) => ({
			title: doc.file.replace('.md', '').replace(/^\d+_/, '').replace(/-/g, ' ').toUpperCase(),
			source: `getting-started/${doc.path || doc.file}`,
			content: doc.content,
		})),
		...creatorDocs.map((doc) => ({
			title: doc.file.replace('.md', '').replace(/^\d+-/, '').replace(/-/g, ' ').toUpperCase(),
			source: `creators/${doc.path || doc.file}`,
			content: doc.content,
		})),
	]

	const creatorLLM = await generateLLMDoc('Creators', creatorSections)
	await writeFile(join(OUTPUT_AGENTS_DIR, 'LLM_Creators.md'), creatorLLM, 'utf-8')
	// Individual file logs removed - only show summary at end

	// Generate Developer LLM doc
	const developerSections = [
		...gettingStartedDocs.map((doc) => ({
			title: doc.file.replace('.md', '').replace(/^\d+_/, '').replace(/-/g, ' ').toUpperCase(),
			source: `getting-started/${doc.path || doc.file}`,
			content: doc.content,
		})),
		...developerDocs.map((doc) => {
			// Extract package name from path (e.g., "01_maia-self/README.md" -> "maia-self")
			const pathParts = (doc.path || doc.file).split('/')
			const packageName = pathParts[0]?.replace(/^\d+_/, '') || doc.file.replace('.md', '')
			const fileName = doc.file.replace('.md', '').replace(/^\d+_/, '')
			const title =
				pathParts.length > 1
					? `${packageName}/${fileName}`.replace(/-/g, ' ').toUpperCase()
					: fileName.replace(/-/g, ' ').toUpperCase()

			return {
				title,
				source: `developers/${doc.path || doc.file}`,
				content: doc.content,
			}
		}),
	]

	const developerLLM = await generateLLMDoc('Developers', developerSections)
	await writeFile(join(OUTPUT_AGENTS_DIR, 'LLM_Developers.md'), developerLLM, 'utf-8')
	// Individual file logs removed - only show summary at end

	// Generate package-specific docs
	const developersDir = join(DOCS_DIR, '03_developers')
	const entries = await readdir(developersDir, { withFileTypes: true })

	for (const entry of entries) {
		if (entry.isDirectory() && /^\d+_/.test(entry.name)) {
			const packageName = extractPackageName(entry.name)
			const packageDir = join(developersDir, entry.name)
			await generatePackageDoc(packageDir, packageName)
		}
	}
}

/**
 * Watch mode
 */
async function watchMode() {
	// Watch status handled by dev.js
	// Initial generation
	await generate()

	// Watch for changes (recursively)
	const watchDirs = [
		GETTING_STARTED_DIR,
		join(DOCS_DIR, '02_creators'),
		join(DOCS_DIR, '03_developers'),
	]

	// Also watch individual package directories
	const developersDir = join(DOCS_DIR, '03_developers')
	try {
		const entries = await readdir(developersDir, { withFileTypes: true })
		for (const entry of entries) {
			if (entry.isDirectory() && /^\d+_/.test(entry.name)) {
				watchDirs.push(join(developersDir, entry.name))
			}
		}
	} catch (_error) {}

	for (const dir of watchDirs) {
		try {
			watch(dir, { recursive: true }, async (_eventType, filename) => {
				if (filename?.endsWith('.md')) {
					// Regenerate silently
					await generate()
				}
			})
		} catch (_error) {}
	}

	// Watch mode active - status handled by dev.js
}

// CLI
const args = process.argv.slice(2)
const isWatch = args.includes('--watch') || args.includes('-w')

if (isWatch) {
	watchMode().catch((_error) => {
		process.exit(1)
	})
} else {
	generate().catch((_error) => {
		process.exit(1)
	})
}
