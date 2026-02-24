// loadSchemaFromDB removed - use resolve() from @MaiaOS/db if needed
import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper'

// getContextValue removed - Backend unified store provides merged value directly via context.value

/** SECURITY: Block prototype chain / constructor access to prevent exploitation */
const FORBIDDEN_PATH_KEYS = ['__proto__', 'constructor', 'prototype']

function assertSafePath(path, context = 'path resolution') {
	if (!path || typeof path !== 'string') return
	const lowerPath = path.toLowerCase()
	for (const key of FORBIDDEN_PATH_KEYS) {
		if (lowerPath.includes(key.toLowerCase())) {
			throw new Error(
				`[Evaluator] Forbidden ${context}: path may not contain '${key}' or similar. Got: ${path}`,
			)
		}
	}
}

function resolvePath(obj, path) {
	if (!path) return obj
	if (!obj) return undefined
	assertSafePath(path, 'path resolution')
	return path.split('.').reduce((acc, key) => {
		assertSafePath(key, 'path segment')
		return acc?.[key]
	}, obj)
}

/**
 * Evaluator - Minimal DSL evaluator for MaiaScript expressions
 * Syntax: $key (context), $$key (item)
 * Supports: $context, $item, $if, $$shorthand
 * Registry-aware for extensible DSL operations
 *
 * Security: Validates expressions before evaluation and enforces depth limits
 */
export class Evaluator {
	constructor(moduleRegistry = null, options = {}) {
		this.registry = moduleRegistry
		this.maxDepth = options.maxDepth || 50 // Maximum recursion depth to prevent DoS
		this.validateExpressions = options.validateExpressions !== false // Enable validation by default
		this.dataEngine = options.dataEngine ?? null
	}

	/**
	 * Evaluate a MaiaScript expression
	 * @param {any} expression - The expression to evaluate
	 * @param {Object} data - The data context { context, item }
	 * @param {number} depth - Current recursion depth (internal)
	 * @returns {Promise<any>} The evaluated result
	 */
	async evaluate(expression, data, depth = 0) {
		// Enforce depth limit to prevent DoS via deeply nested expressions
		if (depth > this.maxDepth) {
			throw new Error(
				`[Evaluator] Maximum recursion depth (${this.maxDepth}) exceeded. Expression may be malicious or too complex.`,
			)
		}

		if (
			this.validateExpressions &&
			depth === 0 &&
			typeof expression === 'object' &&
			expression !== null &&
			!Array.isArray(expression)
		) {
			try {
				if (this.dataEngine?.peer) {
					const schemaKey = `${this.dataEngine.peer.systemSpark}/schema/maia-script-expression`
					const expressionSchema = await this.dataEngine.peer.resolve(schemaKey, {
						returnType: 'schema',
					})
					if (expressionSchema) {
						await validateAgainstSchemaOrThrow(expressionSchema, expression, 'maia-script-expression')
					}
				}
			} catch (error) {
				throw new Error(`[Evaluator] Invalid MaiaScript expression: ${error.message}`)
			}
		}
		if (
			typeof expression === 'number' ||
			typeof expression === 'boolean' ||
			expression === null ||
			expression === undefined
		) {
			return expression
		}

		// Handle compact shortcut syntax: $key (context) or $$key (item)
		if (typeof expression === 'string' && expression.startsWith('$')) {
			return this.evaluateShortcut(expression, data)
		}

		if (typeof expression !== 'object') return expression

		// Handle $context operation
		if ('$context' in expression) {
			return resolvePath(data.context, expression.$context)
		}

		// Handle $item operation
		if ('$item' in expression) {
			return resolvePath(data.item, expression.$item)
		}

		// Handle $eq operation (equality comparison)
		if ('$eq' in expression) {
			const [left, right] = expression.$eq
			const leftValue = await this.evaluate(left, data, depth + 1)
			const rightValue = await this.evaluate(right, data, depth + 1)
			return leftValue === rightValue
		}

		// Handle $ne operation (inequality comparison)
		if ('$ne' in expression) {
			const [left, right] = expression.$ne
			const leftValue = await this.evaluate(left, data, depth + 1)
			const rightValue = await this.evaluate(right, data, depth + 1)
			return leftValue !== rightValue
		}

		// Handle $not operation (logical NOT - negate boolean)
		if ('$not' in expression) {
			const operand = await this.evaluate(expression.$not, data, depth + 1)
			return !operand
		}

		// Handle $and operation (logical AND - all operands must be truthy)
		if ('$and' in expression) {
			const operands = Array.isArray(expression.$and) ? expression.$and : [expression.$and]
			for (const operand of operands) {
				const value = await this.evaluate(operand, data, depth + 1)
				if (!value) {
					return false // Short-circuit: return false if any operand is falsy
				}
			}
			return true // All operands are truthy
		}

		// Handle $or operation (logical OR - at least one operand must be truthy)
		if ('$or' in expression) {
			const operands = Array.isArray(expression.$or) ? expression.$or : [expression.$or]
			for (const operand of operands) {
				const value = await this.evaluate(operand, data, depth + 1)
				if (value) {
					return true // Short-circuit: return true if any operand is truthy
				}
			}
			return false // All operands are falsy
		}

		// Handle $trim operation (string trim whitespace)
		if ('$trim' in expression) {
			const value = await this.evaluate(expression.$trim, data, depth + 1)
			if (typeof value === 'string') {
				return value.trim()
			}
			return value // Return as-is if not a string
		}

		// Handle $gt operation (greater than comparison)
		if ('$gt' in expression) {
			const [left, right] = expression.$gt
			const leftValue = await this.evaluate(left, data, depth + 1)
			const rightValue = await this.evaluate(right, data, depth + 1)
			return leftValue > rightValue
		}

		// Handle $length operation (get array length)
		if ('$length' in expression) {
			const value = await this.evaluate(expression.$length, data, depth + 1)
			return Array.isArray(value) ? value.length : typeof value === 'string' ? value.length : 0
		}

		// Handle $concat operation (concatenate arrays)
		if ('$concat' in expression) {
			const arrays = Array.isArray(expression.$concat) ? expression.$concat : [expression.$concat]
			const evaluatedArrays = await Promise.all(
				arrays.map((arr) => this.evaluate(arr, data, depth + 1)),
			)
			// Filter out null/undefined and ensure all items are arrays before flattening
			const validArrays = evaluatedArrays
				.filter((arr) => arr != null)
				.map((arr) => (Array.isArray(arr) ? arr : [arr]))
			return validArrays.flat()
		}

		// Handle $join operation - join array elements with separator
		if ('$join' in expression) {
			const [arrayExpr, separator = ''] = Array.isArray(expression.$join)
				? expression.$join
				: [expression.$join, '']
			const arr = await this.evaluate(arrayExpr, data, depth + 1)
			return Array.isArray(arr) ? arr.join(separator) : (arr ?? '')
		}

		// Handle $map operation (map over array)
		if ('$map' in expression) {
			const mapConfig = expression.$map
			const arrayExpr = mapConfig.array ?? mapConfig.items
			const array = await this.evaluate(arrayExpr, data, depth + 1)
			// Handle null/undefined or non-array values - return empty array
			if (!array || !Array.isArray(array)) {
				return []
			}
			const itemKey = mapConfig.as || 'item'
			const returnExpr = mapConfig.return || mapConfig.do // Support both "return" and "do"
			if (!returnExpr) {
				throw new Error('[Evaluator] $map operation requires either "return" or "do" property')
			}
			const results = []
			for (const item of array) {
				// Create item data with the current item
				// The item is available as data.item for $$ shortcuts
				// Also make it available under the 'as' key name for nested access patterns
				const itemData = {
					...data,
					item: item,
				}
				// For shortcuts like $$msg.role when as="msg", we need to handle it specially
				// We'll create a wrapper evaluator that handles $$itemKey.path patterns
				const result = await this.evaluateMapReturn(returnExpr, itemData, itemKey, item, depth + 1)
				results.push(result)
			}
			return results
		}

		if ('$if' in expression) {
			let condition = expression.$if.condition
			if (typeof condition === 'string' && condition.startsWith('$')) {
				condition = this.evaluateShortcut(condition, data)
			} else {
				condition = await this.evaluate(condition, data, depth + 1)
			}
			return condition
				? await this.evaluate(expression.$if.then, data, depth + 1)
				: await this.evaluate(expression.$if.else, data, depth + 1)
		}

		if (typeof expression === 'string' && expression.includes('?') && expression.includes(':')) {
			const [conditionStr, rest] = expression.split('?').map((s) => s.trim())
			if (rest) {
				const [thenStr, elseStr] = rest.split(':').map((s) => s.trim())
				const condition = conditionStr.startsWith('$')
					? this.evaluateShortcut(conditionStr, data)
					: await this.evaluate(conditionStr, data, depth + 1)
				return condition
					? await this.evaluate(thenStr, data, depth + 1)
					: await this.evaluate(elseStr, data, depth + 1)
			}
		}

		// Recursively evaluate arrays (e.g. $concat elements like [{role:"user", content:"$pendingInputText"}])
		if (Array.isArray(expression)) {
			return Promise.all(expression.map((item) => this.evaluate(item, data, depth + 1)))
		}

		// Recursively evaluate plain objects (not DSL ops) so nested expressions like content:"$pendingInputText" resolve
		if (typeof expression === 'object' && expression !== null) {
			const result = {}
			for (const [k, v] of Object.entries(expression)) {
				result[k] = await this.evaluate(v, data, depth + 1)
			}
			return result
		}

		// If no DSL operation, return as-is
		return expression
	}

	/**
	 * Evaluate return expression in $map context with custom item key
	 * Handles shortcuts like $$msg.role when as="msg" by treating $$itemKey.path as item.path
	 * @param {any} returnExpr - The return expression to evaluate
	 * @param {Object} data - The data context { context, item, result }
	 * @param {string} itemKey - The 'as' variable name (e.g., "msg")
	 * @param {any} currentItem - The current array item being mapped
	 * @param {number} depth - Current recursion depth
	 * @returns {Promise<any>} The evaluated result
	 */
	async evaluateMapReturn(returnExpr, data, itemKey, currentItem, depth) {
		// If returnExpr is a string shortcut, handle $$itemKey.path patterns
		if (typeof returnExpr === 'string' && returnExpr.startsWith(`$$${itemKey}.`)) {
			// $$msg.role -> item.role when as="msg"
			const path = returnExpr.substring(2 + itemKey.length + 1) // Skip "$$msg."
			return resolvePath(currentItem, path)
		}
		// For objects, recursively evaluate with special handling for $$itemKey shortcuts
		if (typeof returnExpr === 'object' && returnExpr !== null && !Array.isArray(returnExpr)) {
			const result = {}
			for (const [key, value] of Object.entries(returnExpr)) {
				if (typeof value === 'string' && value.startsWith(`$$${itemKey}.`)) {
					// Handle $$msg.role patterns
					const path = value.substring(2 + itemKey.length + 1)
					result[key] = resolvePath(currentItem, path)
				} else {
					// Recursively evaluate other expressions
					result[key] = await this.evaluate(value, data, depth + 1)
				}
			}
			return result
		}
		// For arrays or other types, use normal evaluation
		return await this.evaluate(returnExpr, data, depth + 1)
	}

	/**
	 * Evaluate compact shortcut syntax: $key or $$key
	 * Syntax:
	 * - $key → context.key (implicit context)
	 * - $$key → item.key (explicit item with double-dollar)
	 * - $$result → result (tool result with double-dollar)
	 * @param {string} shortcut - The shortcut string (e.g., "$title", "$$text", "$$result.draggedItemId")
	 * @param {Object} data - The data context { context, item, result }
	 * @returns {any} The evaluated result
	 */
	evaluateShortcut(shortcut, data) {
		if (shortcut.startsWith('$$result')) {
			const path = shortcut.substring(8)
			if (path.startsWith('.')) return resolvePath(data.result, path.substring(1))
			if (path === '') return data.result
		}
		if (shortcut.startsWith('$$')) {
			return resolvePath(data.item, shortcut.substring(2))
		}
		const path = shortcut.substring(1)
		// $stores Architecture: data.context is already the unwrapped value from peer unified store
		// ViewEngine passes context.value as data.context, so we use it directly
		const resolved = resolvePath(data.context, path)
		// Query stores are ReactiveStore objects - unwrap them for evaluation (duck-typing)
		if (resolved && typeof resolved.subscribe === 'function' && 'value' in resolved) {
			return resolved.value
		}
		return resolved
	}

	/**
	 * Check if an expression is a DSL operation
	 * @param {any} expression - The expression to check
	 * @returns {boolean} True if it's a DSL operation
	 */
	isDSLOperation(expression) {
		if (typeof expression === 'string' && expression.startsWith('$')) {
			return true
		}
		if (typeof expression !== 'object' || expression === null) return false
		return (
			'$context' in expression ||
			'$item' in expression ||
			'$if' in expression ||
			'$eq' in expression ||
			'$ne' in expression ||
			'$not' in expression ||
			'$and' in expression ||
			'$or' in expression ||
			'$trim' in expression ||
			'$gt' in expression ||
			'$length' in expression ||
			'$concat' in expression ||
			'$join' in expression ||
			'$map' in expression
		)
	}
}
