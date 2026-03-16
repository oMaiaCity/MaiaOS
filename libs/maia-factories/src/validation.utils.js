/**
 * Validation utilities
 */

export function formatValidationErrors(errors) {
	return (errors || []).map((e) => ({
		instancePath: e.instancePath || '/',
		schemaPath: e.schemaPath || '',
		keyword: e.keyword || '',
		message: e.message || '',
		params: e.params || {},
	}))
}

export function handleValidationResult(formattedErrors, context, throwOnError) {
	if (throwOnError) {
		const ctx = context ? ` for '${context}'` : ''
		const details = formattedErrors.map((e) => `  - ${e.instancePath}: ${e.message}`).join('\n')
		throw new Error(`Validation failed${ctx}:\n${details}`)
	}
	return { valid: false, errors: formattedErrors }
}

export async function withSchemaValidationDisabled(ajv, callback) {
	const orig = ajv.opts.validateSchema
	ajv.opts.validateSchema = false
	try {
		return await callback()
	} finally {
		ajv.opts.validateSchema = orig
	}
}
