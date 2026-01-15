#!/usr/bin/env bun
/**
 * Auto-generate LLM-friendly documentation
 * Combines multiple .md files into single context-optimized files
 * 
 * Output:
 * - docs/agents/LLM_Vibecreator.md (ARCHITECTURE + vibecreators docs)
 * - docs/agents/LLM_Developers.md (ARCHITECTURE + developers docs)
 * 
 * Reads from: docs/ (getting-started, vibecreators, developers)
 * Writes to: docs/agents/ (LLM documentation files)
 * 
 * Runs on file changes in watch mode
 */

import { watch } from 'fs';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DOCS_DIR = join(__dirname, '../docs');
const OUTPUT_AGENTS_DIR = join(__dirname, '../docs/agents');
const GETTING_STARTED_DIR = join(DOCS_DIR, 'getting-started');

/**
 * Read all markdown files from a directory
 */
async function readMarkdownFiles(dir) {
  try {
    const files = await readdir(dir);
    const mdFiles = files
      .filter(f => f.endsWith('.md'))
      .sort(); // Alphabetical order (01-, 02-, etc.)
    
    const contents = [];
    for (const file of mdFiles) {
      const filePath = join(dir, file);
      const content = await readFile(filePath, 'utf-8');
      contents.push({
        file,
        content: content.trim()
      });
    }
    return contents;
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
    return [];
  }
}

/**
 * Generate LLM documentation file
 */
async function generateLLMDoc(type, sections) {
  const timestamp = new Date().toISOString();
  
  let output = `# MaiaOS Documentation for ${type}\n\n`;
  output += `**Auto-generated:** ${timestamp}\n`;
  output += `**Purpose:** Complete context for LLM agents working with MaiaOS\n\n`;
  output += `---\n\n`;
  
  // Add each section
  for (const section of sections) {
    output += `# ${section.title}\n\n`;
    if (section.source) {
      output += `*Source: ${section.source}*\n\n`;
    }
    output += `${section.content}\n\n`;
    output += `---\n\n`;
  }
  
  return output;
}

/**
 * Main generation function
 */
async function generate() {
  console.log('📝 Generating LLM documentation...');
  
  try {
    // Ensure agents directory exists
    await mkdir(OUTPUT_AGENTS_DIR, { recursive: true });
    
    // Read getting-started docs (prefix for both)
    const gettingStartedDocs = await readMarkdownFiles(GETTING_STARTED_DIR);
    
    // Read vibecreators docs
    const vibecreatorDocs = await readMarkdownFiles(join(DOCS_DIR, 'vibecreators'));
    
    // Read developers docs
    const developerDocs = await readMarkdownFiles(join(DOCS_DIR, 'developers'));
    
    // Generate Vibecreator LLM doc
    const vibecreatorSections = [
      ...gettingStartedDocs.map(doc => ({
        title: doc.file.replace('.md', '').replace(/^\d+_/, '').replace(/-/g, ' ').toUpperCase(),
        source: `getting-started/${doc.file}`,
        content: doc.content
      })),
      ...vibecreatorDocs.map(doc => ({
        title: doc.file.replace('.md', '').replace(/^\d+-/, '').replace(/-/g, ' ').toUpperCase(),
        source: `vibecreators/${doc.file}`,
        content: doc.content
      }))
    ];
    
    const vibecreatorLLM = await generateLLMDoc('Vibecreators', vibecreatorSections);
    await writeFile(
      join(OUTPUT_AGENTS_DIR, 'LLM_Vibecreator.md'),
      vibecreatorLLM,
      'utf-8'
    );
    console.log('✅ Generated LLM_Vibecreator.md');
    
    // Generate Developer LLM doc
    const developerSections = [
      ...gettingStartedDocs.map(doc => ({
        title: doc.file.replace('.md', '').replace(/^\d+_/, '').replace(/-/g, ' ').toUpperCase(),
        source: `getting-started/${doc.file}`,
        content: doc.content
      })),
      ...developerDocs.map(doc => ({
        title: doc.file.replace('.md', '').replace(/-/g, ' ').toUpperCase(),
        source: `developers/${doc.file}`,
        content: doc.content
      }))
    ];
    
    const developerLLM = await generateLLMDoc('Developers', developerSections);
    await writeFile(
      join(OUTPUT_AGENTS_DIR, 'LLM_Developers.md'),
      developerLLM,
      'utf-8'
    );
    console.log('✅ Generated LLM_Developers.md');
    
    console.log('🎉 LLM documentation generated successfully!');
    console.log(`📍 Output: ${OUTPUT_AGENTS_DIR}`);
  } catch (error) {
    console.error('❌ Error generating LLM docs:', error);
    throw error;
  }
}

/**
 * Watch mode
 */
async function watchMode() {
  console.log('👀 Watching for documentation changes...');
  
  // Initial generation
  await generate();
  
  // Watch for changes
  const watchDirs = [
    GETTING_STARTED_DIR,
    join(DOCS_DIR, 'vibecreators'),
    join(DOCS_DIR, 'developers')
  ];
  
  for (const dir of watchDirs) {
    try {
      watch(dir, { recursive: false }, async (eventType, filename) => {
        if (filename && filename.endsWith('.md')) {
          console.log(`\n🔄 Detected change: ${filename}`);
          await generate();
        }
      });
    } catch (error) {
      console.warn(`⚠️  Could not watch ${dir}:`, error.message);
    }
  }
  
  console.log('✨ Watch mode active. Press Ctrl+C to stop.\n');
}

// CLI
const args = process.argv.slice(2);
const isWatch = args.includes('--watch') || args.includes('-w');

if (isWatch) {
  watchMode().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} else {
  generate().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
