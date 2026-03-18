/**
 * Registry - Central plugin system for MaiaScript module extensions
 */

const BUILTIN_MODULES = {
	db: {
		config: {
			name: 'db',
			version: '1.0.0',
			description: 'Unified database operation API',
			namespace: '@maia/actor/os',
			tools: ['@maia/actor/os/db'],
		},
		query: (q) => (q === 'tools' ? ['@maia/actor/os/db'] : null),
	},
	core: {
		config: {
			name: 'core',
			version: '1.0.0',
			description: 'Core UI tools (view modes, modals, utilities)',
			namespace: '@core',
			tools: ['preventDefault'],
		},
		query: () => null,
	},
	ai: {
		config: {
			name: 'ai',
			version: '1.0.0',
			description: 'Unified AI tool for OpenAI-compatible API integration (RedPill)',
			namespace: '@maia/actor/os',
			tools: ['@maia/actor/os/ai'],
		},
		query: (q) => (q === 'tools' ? ['@maia/actor/os/ai'] : null),
	},
}

export async function registerBuiltinModules(registry, moduleNames) {
	for (const name of moduleNames) {
		const mod = BUILTIN_MODULES[name]
		if (mod) await registry.registerModule(name, mod, mod.config)
	}
}

export class Registry {
	constructor() {
		this.modules = new Map()
		this.moduleConfigs = new Map()
	}

	registerModule(name, module, config = {}) {
		this.modules.set(name, module)
		this.moduleConfigs.set(name, {
			name,
			version: config.version || '1.0.0',
			description: config.description || '',
			...config,
		})
	}

	getModule(name) {
		return this.modules.get(name) || null
	}

	getModuleConfig(name) {
		return this.moduleConfigs.get(name) || null
	}

	hasModule(name) {
		return this.modules.has(name)
	}

	listModules() {
		return Array.from(this.modules.keys())
	}

	async loadModule(moduleName, modulePath = null) {
		if (this.hasModule(moduleName)) return
		const mod = BUILTIN_MODULES[moduleName]
		if (mod) {
			await this.registerModule(moduleName, mod, mod.config)
			return
		}
		const path = modulePath || `./${moduleName}.module.js`
		const m = await import(/* @vite-ignore */ path)
		if (m.default?.register) await m.default.register(this)
		else if (typeof m.register === 'function') await m.register(this)
	}

	query(moduleName, query) {
		const module = this.getModule(moduleName)
		if (!module) return null
		if (typeof module.query === 'function') return module.query(query)
		if (module.config && query in module.config) return module.config[query]
		return null
	}
}
