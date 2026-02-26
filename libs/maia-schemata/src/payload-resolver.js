/**
 * Universal Payload Resolution Interface
 *
 * DOM markers (view layer) - @inputValue, @dataColumn, @fileFromInput
 * MaiaScript expressions: Use resolveExpressions from expression-resolver directly
 */

/**
 * Read file from input as base64 (async)
 * @param {HTMLInputElement} input - File input element
 * @returns {Promise<{fileBase64: string, mimeType: string, fileName: string}|null>}
 */
export async function readFileAsUploadPayload(input) {
	const file = input?.files?.[0]
	if (!file) return null
	return new Promise((resolve) => {
		const reader = new FileReader()
		reader.onload = () => {
			const dataUrl = reader.result
			const [header, base64] =
				typeof dataUrl === 'string' && dataUrl.includes(',') ? dataUrl.split(',') : ['', '']
			const mime = header.match(/:(.*?);/)?.[1] || file.type || 'application/octet-stream'
			resolve({ fileBase64: base64, mimeType: mime, fileName: file.name })
		}
		reader.onerror = () => resolve(null)
		reader.readAsDataURL(file)
	})
}

/**
 * Extract DOM marker values ONLY (view layer)
 * Preserves all MaiaScript expressions ($, $$, DSL) for state machine to resolve
 *
 * @param {any} payload - The payload to process
 * @param {HTMLElement} element - The DOM element (for @inputValue, @dataColumn)
 * @returns {any} Payload with DOM values extracted, MaiaScript expressions preserved
 */
export function extractDOMValues(payload, element) {
	if (!payload || typeof payload !== 'object') {
		return payload
	}

	// Handle arrays - recursively process each element
	if (Array.isArray(payload)) {
		return payload.map((item) => extractDOMValues(item, element))
	}

	// Handle objects - extract DOM markers only
	const result = {}
	for (const [key, value] of Object.entries(payload)) {
		// Handle special @inputValue marker (DOM-specific)
		if (value === '@inputValue') {
			// When event target is a button, element.value is empty - use form's/container's first input
			let inputEl = element
			if (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
				const formOrContainer =
					element.closest('form') || element.closest('[class*="form"]') || element.parentElement
				inputEl = formOrContainer?.querySelector('input, textarea') ?? element
			}
			result[key] = (inputEl?.value ?? '') || ''
		}
		// Handle special @dataColumn marker (DOM-specific, extracts data-column attribute)
		else if (value === '@dataColumn') {
			result[key] = element.dataset.column || element.getAttribute('data-column') || null
		}
		// @fileFromInput: async - caller must use extractDOMValuesAsync for file inputs
		else if (value === '@fileFromInput') {
			result[key] = value // Leave as marker; extractDOMValuesAsync handles it
		}
		// Handle nested objects/arrays - recursively extract DOM markers
		else if (typeof value === 'object' && value !== null) {
			result[key] = extractDOMValues(value, element)
		}
		// Keep as-is (including MaiaScript expressions like $context, $$id, DSL operations)
		else {
			result[key] = value
		}
	}

	return result
}

/**
 * Async variant: when payload contains @fileFromInput, read file and merge result
 * @param {any} payload - The payload to process
 * @param {HTMLElement} element - The DOM element (event target, or file input)
 * @returns {Promise<any>} Payload with DOM values extracted, file data merged when @fileFromInput
 */
export async function extractDOMValuesAsync(payload, element) {
	const DEBUG =
		typeof window !== 'undefined' &&
		(window.location?.hostname === 'localhost' || import.meta?.env?.DEV)
	let result = extractDOMValues(payload, element)
	const fileInput =
		element?.tagName === 'INPUT' && element?.type === 'file'
			? element
			: element?.querySelector?.('input[type=file]') ||
				element
					?.closest?.('form, [class*="upload"], [class*="profile-image"], [class*="wrapper"]')
					?.querySelector?.('input[type=file]')
	if (DEBUG && Object.values(result || {}).includes('@fileFromInput')) {
		console.log('[ProfileImagePipe] extractDOMValuesAsync: @fileFromInput detected', {
			hasFileInput: !!fileInput,
			fileInputHasFiles: !!fileInput?.files?.[0],
			elementTag: element?.tagName,
			elementClass: element?.className,
		})
	}
	if (
		fileInput &&
		result &&
		typeof result === 'object' &&
		Object.values(result).includes('@fileFromInput')
	) {
		const fileData = await readFileAsUploadPayload(fileInput)
		if (DEBUG) {
			console.log('[ProfileImagePipe] extractDOMValuesAsync: fileData resolved', {
				hasFileData: !!fileData,
				mimeType: fileData?.mimeType,
				fileName: fileData?.fileName,
				base64Length: fileData?.fileBase64?.length ?? 0,
			})
		}
		if (fileData) {
			result = { ...result, ...fileData }
			for (const k of Object.keys(result)) {
				if (result[k] === '@fileFromInput') delete result[k]
			}
		}
	}
	return result
}
