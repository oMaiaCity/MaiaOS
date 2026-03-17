/**
 * AJV Plugin for CoJSON Types (re-export)
 */

import { plugin as cojsonPlugin, pluginId as cojsonPluginId } from './plugins/cojson.plugin.js'
import { ValidationPluginRegistry } from './validation-plugin-registry.js'

const registry = new ValidationPluginRegistry()
registry.registerPlugin(cojsonPluginId, cojsonPlugin)

/**
 * Register CoJSON type keywords with AJV
 * @param {import('ajv').default} ajv - AJV instance
 */
export function ajvCoTypesPlugin(ajv) {
	registry.applyTo(ajv)
}
