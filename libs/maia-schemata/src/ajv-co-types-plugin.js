/**
 * AJV Plugin for CoJSON Types (re-export / backward compatibility)
 *
 * @deprecated Use ValidationPluginRegistry with cojson.plugin.js instead.
 * This module re-exports for backward compatibility.
 */

import { plugin as cojsonPlugin, pluginId as cojsonPluginId } from './plugins/cojson.plugin.js'
import { ValidationPluginRegistry } from './validation-plugin-registry.js'

const registry = new ValidationPluginRegistry()
registry.registerPlugin(cojsonPluginId, cojsonPlugin)

/**
 * Register CoJSON type keywords with AJV
 * @param {import('ajv').default} ajv - AJV instance
 * @deprecated Use ValidationPluginRegistry and cojson.plugin.js instead
 */
export function ajvCoTypesPlugin(ajv) {
	registry.applyTo(ajv)
}
