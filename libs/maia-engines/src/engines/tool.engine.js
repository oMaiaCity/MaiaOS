import { validateAgainstSchemaOrThrow } from '@MaiaOS/schemata/validation.helper'

export class ToolEngine {
	constructor(moduleRegistry) {
		this.moduleRegistry = moduleRegistry
		this.tools = new Map()
	}

	async registerTool(namespacePath, toolRegistryName, options = {}) {
		if (!options.definition || !options.function) return
		this.tools.set(toolRegistryName, {
			definition: options.definition,
			function: options.function,
			namespacePath,
		})
	}

	async execute(actionName, actor, payload) {
		const tool = this.tools.get(actionName)
		if (!tool) {
			const availableTools = Array.from(this.tools.keys())
			throw new Error(`Tool not found: ${actionName}. Available tools: ${availableTools.join(', ')}`)
		}
		const fn = tool.definition?.function ?? tool.definition
		const parametersSchema =
			fn?.parameters ?? fn?.params ?? tool.definition?.parameters ?? tool.definition?.params
		if (parametersSchema) {
			await validateAgainstSchemaOrThrow(
				this._normalizeToolSchema(parametersSchema),
				payload,
				'tool-payload',
			)
		}
		return await tool.function.execute(actor, payload)
	}

	_normalizeToolSchema(schema) {
		const cleanProps = (props) => {
			const cleaned = {}
			const required = []
			for (const [key, prop] of Object.entries(props)) {
				if (prop && typeof prop === 'object' && prop.type !== 'function') {
					const { required: req, type, ...rest } = prop
					cleaned[key] = { type, ...rest }
					if (req === true) required.push(key)
				} else if (prop && typeof prop === 'object') {
					cleaned[key] = prop
				}
			}
			return { cleaned, required }
		}

		if (schema.type === 'object' && !schema.properties) return schema
		const props = schema.properties || schema
		const { cleaned, required } = cleanProps(props)
		const existingRequired = Array.isArray(schema.required) ? schema.required : []
		return {
			type: 'object',
			properties: cleaned,
			required: [...new Set([...existingRequired, ...required])],
		}
	}

	getToolDefinition(toolName) {
		return this.tools.get(toolName)?.definition || null
	}
	getAllTools() {
		return Array.from(this.tools.values()).map((t) => t.definition)
	}
}
