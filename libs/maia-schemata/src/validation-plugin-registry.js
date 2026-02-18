/**
 * ValidationPluginRegistry - Pluggable AJV extensions for MaiaOS schemata
 *
 * Mirrors the tools/operations extension pattern. Plugins register
 * keywords, formats, and validators. ValidationEngine calls applyTo(ajv)
 * during initialization.
 */

export class ValidationPluginRegistry {
	constructor() {
		this.plugins = new Map() // pluginId → plugin
	}

	/**
	 * Register a validation plugin
	 * @param {string} pluginId - Unique plugin identifier (e.g. '@schemata/cojson')
	 * @param {Object} plugin - Plugin definition
	 * @param {Array} [plugin.keywords] - AJV keyword definitions
	 * @param {Array} [plugin.formats] - AJV format definitions
	 * @param {Array} [plugin.validators] - Business-logic validators (future)
	 */
	registerPlugin(pluginId, plugin) {
		if (this.plugins.has(pluginId)) {
			console.warn(`[ValidationPluginRegistry] Plugin "${pluginId}" already registered, overwriting`)
		}
		this.plugins.set(pluginId, plugin)
	}

	/**
	 * Apply all registered plugins to an AJV instance
	 * @param {import('ajv').default} ajv - AJV instance
	 */
	applyTo(ajv) {
		for (const [, plugin] of this.plugins) {
			if (plugin.keywords) {
				for (const kw of plugin.keywords) {
					ajv.addKeyword(kw)
				}
			}
			if (plugin.formats) {
				for (const fmt of plugin.formats) {
					ajv.addFormat(fmt.name, fmt.definition || fmt)
				}
			}
		}
	}
}
