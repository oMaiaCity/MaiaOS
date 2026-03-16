/**
 * Markdown rendering with sanitization for safe innerHTML use.
 */

import DOMPurify from 'dompurify'
import { marked } from 'marked'

/**
 * Parse markdown to HTML and sanitize for safe DOM insertion.
 * @param {string} rawText - Raw markdown string
 * @returns {Promise<string>} Sanitized HTML
 */
export async function renderMarkdown(rawText) {
	if (rawText == null || typeof rawText !== 'string') return ''
	const html = await marked.parse(rawText)
	return DOMPurify.sanitize(String(html))
}
