/**
 * Design System
 * 
 * Registers design system schemas in hardcoded registry
 * All design system components are now schema-driven
 */

// Register design system schemas in hardcoded registry
import { registerJsonSchema } from '@hominio/db'
import {
	titleSchemaDefinition,
	errorSchemaDefinition,
	modalCloseButtonSchemaDefinition,
	inputFormSchemaDefinition,
	timelineHeaderSchemaDefinition,
	viewButtonsSchemaDefinition,
	headerSchemaDefinition,
	modalSchemaDefinition,
	inputSectionSchemaDefinition,
	rootCardSchemaDefinition,
} from './schemas'

/**
 * Register all design system schemas
 * Call this function to ensure schemas are registered before use
 */
export function registerDesignSystemSchemas() {
	// Leaf schemas
	registerJsonSchema('design-system.title', titleSchemaDefinition)
	registerJsonSchema('design-system.error', errorSchemaDefinition)
	registerJsonSchema('design-system.modalCloseButton', modalCloseButtonSchemaDefinition)
	registerJsonSchema('design-system.inputForm', inputFormSchemaDefinition)
	registerJsonSchema('design-system.timelineHeader', timelineHeaderSchemaDefinition)
	registerJsonSchema('design-system.viewButtons', viewButtonsSchemaDefinition)
	// Composite schemas
	registerJsonSchema('design-system.header', headerSchemaDefinition)
	registerJsonSchema('design-system.modal', modalSchemaDefinition)
	registerJsonSchema('design-system.inputSection', inputSectionSchemaDefinition)
	registerJsonSchema('design-system.rootCard', rootCardSchemaDefinition)
}

// Auto-register on import (side effect)
registerDesignSystemSchemas()
