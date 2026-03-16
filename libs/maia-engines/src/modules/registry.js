/**
 * Registry - Central plugin system for MaiaScript module extensions
 */

function createModule(name, config, query = () => null) {
	const module = { config, query }
	return {
		config,
		async register(registry) {
			registry.registerModule(name, module, config)
		},
	}
}

const BUILTIN_MODULES = {
	db: createModule(
		'db',
		{
			version: '1.0.0',
			description: 'Unified database operation API',
			namespace: '@maia/actor/os',
			tools: ['@maia/actor/os/db'],
		},
		(q) => (q === 'tools' ? ['@maia/actor/os/db'] : null),
	),
	core: createModule('core', {
		version: '1.0.0',
		description: 'Core UI tools (view modes, modals, utilities)',
		namespace: '@core',
		tools: ['preventDefault'],
	}),
	ai: createModule(
		'ai',
		{
			version: '1.0.0',
			description: 'Unified AI tool for OpenAI-compatible API integration (RedPill)',
			namespace: '@maia/actor/os',
			tools: ['@maia/actor/os/ai'],
		},
		(q) => (q === 'tools' ? ['@maia/actor/os/ai'] : null),
	),
}

/** Register built-in modules (db, core, ai) by name. */
export async function registerBuiltinModules(registry, moduleNames) {
	for (const name of moduleNames) {
		const mod = BUILTIN_MODULES[name]
		if (mod) await mod.register(registry)
	}
}

export class Registry {
	constructor() {
		this.modules = new Map() // moduleName → module instance
		this.moduleConfigs = new Map() // moduleName → config/metadata
	}

	/**
	 * Register a MaiaScript module
	 * @param {string} name - Module name (e.g., 'core', 'dragdrop')
	 * @param {Object} module - Module instance or class
	 * @param {Object} config - Optional module configuration/metadata
	 */
	registerModule(name, module, config = {}) {
		this.modules.set(name, module)
		this.moduleConfigs.set(name, {
			name,
			version: config.version || '1.0.0',
			description: config.description || '',
			...config,
		})

		// Silent - kernel logs module summary
	}

	/**
	 * Get a module by name
	 * @param {string} name - Module name
	 * @returns {Object|null} Module instance or null
	 */
	getModule(name) {
		return this.modules.get(name) || null
	}

	/**
	 * Get module configuration
	 * @param {string} name - Module name
	 * @returns {Object|null} Module config or null
	 */
	getModuleConfig(name) {
		return this.moduleConfigs.get(name) || null
	}

	/**
	 * Check if a module exists
	 * @param {string} name - Module name
	 * @returns {boolean}
	 */
	hasModule(name) {
		return this.modules.has(name)
	}

	/**
	 * List all registered modules
	 * @returns {Array<string>} Array of module names
	 */
	listModules() {
		return Array.from(this.modules.keys())
	}

	/**
	 * List all module configs
	 * @returns {Array<Object>} Array of module configurations
	 */
	listModuleConfigs() {
		return Array.from(this.moduleConfigs.values())
	}

	/**
	 * Clear all registered modules
	 * @internal For testing purposes only
	 */
	clear() {
		this.modules.clear()
		this.moduleConfigs.clear()
		console.log('[Registry] Cleared all modules')
	}

	/**
	 * Load a module (imports and registers)
	 * @param {string} moduleName - Module name to load
	 * @param {string} modulePath - Path to module file (optional, defaults to modules/{name}.module.js)
	 * @returns {Promise<void>}
	 */
	async loadModule(moduleName, modulePath = null) {
		if (this.hasModule(moduleName)) {
			console.log(`[Registry] Module "${moduleName}" already loaded`)
			return
		}
		const mod = BUILTIN_MODULES[moduleName]
		if (mod) {
			await mod.register(this)
			return
		}
		const path = modulePath || `./${moduleName}.module.js`
		const module = await import(/* @vite-ignore */ path)
		if (module.default?.register) await module.default.register(this)
		else if (typeof module.register === 'function') await module.register(this)
	}

	/**
	 * Query module for configuration/data
	 * @param {string} moduleName - Module name
	 * @param {string} query - Query string
	 * @returns {any} Query result or null
	 */
	query(moduleName, query) {
		const module = this.getModule(moduleName)
		if (!module) return null
		if (typeof module.query === 'function') return module.query(query)
		if (module.config && query in module.config) return module.config[query]
		return null
	}
}
