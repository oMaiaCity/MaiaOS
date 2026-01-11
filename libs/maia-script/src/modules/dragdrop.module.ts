/**
 * MaiaScript Drag-Drop Module
 * Provides declarative drag-drop capabilities
 * Phase 6: Drag-Drop Capability Module
 */

import { maiaScriptModuleRegistry } from './registry'
import type { MaiaScriptModule, Capability, ViewNode } from './types'
import dragDropRules from './dragdrop.rules.json'

/**
 * Apply draggable capability to a ViewNode
 */
const draggableCapability: Capability = {
  name: 'draggable',
  apply: (node: ViewNode, data: Record<string, any>): ViewNode => {
    // Ensure events object exists
    if (!node.leaf && !node.composite) return node

    const target = node.leaf || node.composite
    if (!target) return node

    // Add draggable attribute
    if (target.container) {
      target.container.draggable = true
    } else {
      target.draggable = true
    }

    // Add drag visual feedback classes
    const feedbackClasses = dragDropRules.rules.dragVisualFeedback.draggableClass
    if (target.classes) {
      target.classes = `${target.classes} ${feedbackClasses}`
    } else {
      target.classes = feedbackClasses
    }

    // Note: Actual event handlers are still handled by ViewEngine
    // This capability just marks the node as draggable
    
    return node
  }
}

/**
 * Apply dropzone capability to a ViewNode
 */
const dropzoneCapability: Capability = {
  name: 'dropzone',
  apply: (node: ViewNode, data: Record<string, any>): ViewNode => {
    // Ensure events object exists
    if (!node.leaf && !node.composite) return node

    const target = node.leaf || node.composite
    if (!target) return node

    // Add visual feedback for dropzone
    // Note: dragover state is handled dynamically by ViewEngine
    
    // The actual drop handlers are defined in the ViewNode's events
    // This capability just marks it as a dropzone visually
    
    return node
  }
}

/**
 * Drag-Drop Module
 */
const dragDropModule: MaiaScriptModule = {
  name: 'dragdrop',
  version: '1.0.0',
  operations: {},
  capabilities: {
    draggable: draggableCapability,
    dropzone: dropzoneCapability
  }
}

// Auto-register on import
maiaScriptModuleRegistry.register(dragDropModule)

export { dragDropModule }
