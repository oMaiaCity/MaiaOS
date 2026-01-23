/**
 * ViewEngine Module
 * 
 * Re-exports for backward compatibility.
 * Import from this file to use ViewEngine.
 */

export { ViewEngine } from './view.engine.js';
export { renderNode, renderEach, applyNodeAttributes, renderNodeChildren } from './renderer.js';
export { renderSlot, createSlotWrapper } from './slots.js';
export { attachEvents, handleEvent, resolvePayload } from './events.js';
export { resolveDataAttributes, toKebabCase } from './data-attributes.js';
