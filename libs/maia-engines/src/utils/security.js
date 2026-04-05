/**
 * Security constants and payload sanitization for DOM/CSS/expression validation.
 * Single source of truth for XSS prevention across ViewEngine, StyleEngine, Evaluator.
 */

/** SECURITY: Block prototype chain / constructor access to prevent exploitation */
export const FORBIDDEN_PATH_KEYS = ['__proto__', 'constructor', 'prototype']

/** SECURITY: Block CSS injection via url(), expression(), -moz-binding, etc. */
export const CSS_INJECTION_PATTERNS = [
	/javascript\s*:/i,
	/vbscript\s*:/i,
	/data\s*:\s*[^,]*base64\s*,/i,
	/expression\s*\(/i,
	/-moz-binding\s*:/i,
	/@import\b/i,
	/behavior\s*:/i,
]

/** SECURITY: Tag allowlist for createElement - prevents script/iframe/object/embed injection */
export const SAFE_TAGS = new Set([
	'div',
	'span',
	'p',
	'a',
	'button',
	'input',
	'textarea',
	'select',
	'option',
	'optgroup',
	'form',
	'label',
	'fieldset',
	'legend',
	'img',
	'picture',
	'source',
	'ul',
	'ol',
	'li',
	'dl',
	'dt',
	'dd',
	'table',
	'thead',
	'tbody',
	'tfoot',
	'tr',
	'th',
	'td',
	'caption',
	'colgroup',
	'col',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'header',
	'footer',
	'main',
	'nav',
	'section',
	'article',
	'aside',
	'details',
	'summary',
	'figure',
	'figcaption',
	'blockquote',
	'pre',
	'code',
	'em',
	'strong',
	'small',
	'sub',
	'sup',
	'mark',
	'del',
	'ins',
	'abbr',
	'time',
	'progress',
	'meter',
	'output',
	'dialog',
	'hr',
	'br',
	'video',
	'audio',
	'canvas',
	'svg',
	'path',
	'circle',
	'rect',
	'line',
	'polyline',
	'polygon',
	'text',
	'g',
	'defs',
	'use',
	'symbol',
])

/** Boolean HTML attributes (set via element[name] = bool) */
export const BOOLEAN_ATTRS = new Set([
	'disabled',
	'readonly',
	'checked',
	'selected',
	'autofocus',
	'required',
	'multiple',
])

/** SECURITY: URL-bearing attributes - require safe protocol (blocks javascript:, data:, etc.) */
export const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster'])

const COJSON_METADATA_KEYS = new Set(['_coValueType', 'cotype', 'groupInfo', 'loading', 'error'])

function normalizeInterfaceItem(x) {
	if (x == null) return { name: '' }
	if (typeof x === 'string') return { name: x }
	if (typeof x === 'object' && 'name' in x) return { name: String(x.name ?? '') }
	if (typeof x === 'object') return { name: String(x.id ?? x.key ?? Object.keys(x)[0] ?? '') }
	return { name: String(x) }
}

function interfaceToArray(val) {
	if (val == null) return []
	if (Array.isArray(val)) return val.map(normalizeInterfaceItem)
	if (typeof val !== 'object') return []
	const keys = Object.keys(val)
	if (keys.length === 0) return []
	const numericKeys = keys.every((k) => /^\d+$/.test(k))
	if (numericKeys) {
		return keys.sort((a, b) => Number(a) - Number(b)).map((k) => normalizeInterfaceItem(val[k]))
	}
	const props = val.properties || val
	if (typeof props === 'object' && props !== null) {
		return Object.keys(props)
			.filter((k) => !k.startsWith('$'))
			.map((k) => ({ name: k }))
	}
	return keys.filter((k) => !k.startsWith('$')).map((k) => ({ name: k }))
}

/** Strip infrastructure keys (replyTo, etc.) for schema validation. */
export function stripInfrastructureKeysForValidation(payload) {
	if (!payload || typeof payload !== 'object') return payload
	const { replyTo, ...rest } = payload
	return rest
}

/** Sanitize payload for interface validation. Strip CoJSON metadata, normalize interface/definition. */
export function sanitizePayloadForValidation(payload) {
	if (!payload || typeof payload !== 'object') return payload
	if (Array.isArray(payload)) return payload.map(sanitizePayloadForValidation)
	const result = {}
	for (const [k, v] of Object.entries(payload)) {
		if (COJSON_METADATA_KEYS.has(k)) continue
		if (k === 'definition' && v != null && typeof v === 'object') {
			result[k] = JSON.stringify(v, null, 2)
		} else if (k === 'interface') {
			if (Array.isArray(v)) result[k] = v.map(normalizeInterfaceItem)
			else if (v != null && typeof v === 'object') result[k] = interfaceToArray(v)
			else if (typeof v === 'string') result[k] = []
			else result[k] = v
		} else if (k === 'item' && v != null && typeof v === 'object') {
			const allowed = ['id', 'label', 'definition', 'interface', 'wasmCode', 'hasWasmCode']
			const sub = {}
			for (const key of allowed) {
				if (key in v) {
					const val = v[key]
					if (key === 'interface') {
						if (Array.isArray(val)) sub[key] = val.map(normalizeInterfaceItem)
						else if (val != null && typeof val === 'object') sub[key] = interfaceToArray(val)
						else if (typeof val === 'string') sub[key] = []
						else sub[key] = []
					} else if (key === 'definition' && val != null && typeof val === 'object') {
						sub[key] = JSON.stringify(val, null, 2)
					} else if (key === 'id' && val != null && typeof val === 'object') {
						sub[key] = String(val.id ?? val.$id ?? val.coId ?? '')
					} else if (key === 'label' && val != null && typeof val === 'object') {
						sub[key] = String(val.$label ?? val.label ?? val.name ?? '')
					} else if (!COJSON_METADATA_KEYS.has(key)) {
						sub[key] =
							val != null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof File)
								? sanitizePayloadForValidation(val)
								: val
					}
				}
			}
			result[k] = sub
		} else if (v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof File)) {
			result[k] = sanitizePayloadForValidation(v)
		} else {
			result[k] = v
		}
	}
	return result
}
