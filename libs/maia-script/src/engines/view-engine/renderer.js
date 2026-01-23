/**
 * Renderer Module
 * 
 * Handles core rendering logic: renderNode, renderEach, and attribute application.
 */

import { sanitizeAttribute, containsDangerousHTML } from '../../utils/html-sanitizer.js';
import { resolveDataAttributes } from './data-attributes.js';
import { renderSlot } from './slots.js';
import { attachEvents } from './events.js';

/**
 * Apply node attributes (class, attrs, value, text)
 * @param {Object} viewEngine - ViewEngine instance
 * @param {HTMLElement} element - The element to apply attributes to
 * @param {Object} node - The node definition
 * @param {Object} data - The data context { context, item }
 * @param {string} actorId - The actor ID
 * @returns {Promise<void>}
 */
export async function applyNodeAttributes(viewEngine, element, node, data, actorId) {
  // Handle class attribute
  if (node.class) {
    // Reject $if in class (removed - use data-attributes + CSS instead)
    if (typeof node.class === 'object' && node.class.$if) {
      throw new Error('[ViewEngine] "$if" is no longer supported in class property. Use data-attributes and CSS instead.');
    }
    const classValue = await viewEngine.evaluator.evaluate(node.class, data);
    if (classValue) {
      element.className = classValue;
    }
  }

  // Handle attrs (other HTML attributes)
  if (node.attrs) {
    for (const [attrName, attrValue] of Object.entries(node.attrs)) {
      // Special handling for data-attribute mapping
      if (attrName === 'data') {
        await resolveDataAttributes(viewEngine, attrValue, data, element);
      } else {
        // Regular attributes
        const resolvedValue = await viewEngine.evaluator.evaluate(attrValue, data);
        if (resolvedValue !== undefined && resolvedValue !== null) {
          // Convert boolean to string for data attributes (CSS selectors need strings)
          let stringValue = typeof resolvedValue === 'boolean' ? String(resolvedValue) : String(resolvedValue);
          
          // Sanitize attribute values to prevent XSS (defensive hardening)
          // Note: setAttribute() already escapes quotes, but we sanitize for extra safety
          if (containsDangerousHTML(stringValue)) {
            console.warn(`[ViewEngine] Potentially dangerous HTML detected in attribute ${attrName}, sanitizing`);
            stringValue = sanitizeAttribute(stringValue);
          }
          
          element.setAttribute(attrName, stringValue);
        }
      }
    }
  }

  // Handle value (for input/textarea elements)
  if (node.value !== undefined) {
    const resolvedValue = await viewEngine.evaluator.evaluate(node.value, data);
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      if (element.tagName === 'INPUT') {
        element.value = resolvedValue || '';
      } else {
        element.textContent = resolvedValue || '';
      }
      
      // Add stable unique identifier for focus restoration
      // Use a counter per actor to ensure same input gets same ID across re-renders
      if (!viewEngine.actorInputCounters.has(actorId)) {
        viewEngine.actorInputCounters.set(actorId, 0);
      }
      const inputIndex = viewEngine.actorInputCounters.get(actorId);
      viewEngine.actorInputCounters.set(actorId, inputIndex + 1);
      
      const inputId = `${actorId}_input_${inputIndex}`;
      element.setAttribute('data-actor-input', inputId);
    }
  }

  // Handle text content
  if (node.text !== undefined) {
    const textValue = await viewEngine.evaluator.evaluate(node.text, data);
    element.textContent = textValue || '';
  }
}

/**
 * Render node children
 * @param {Object} viewEngine - ViewEngine instance
 * @param {HTMLElement} element - The parent element
 * @param {Object} node - The node definition
 * @param {Object} data - The data context { context, item }
 * @param {string} actorId - The actor ID
 * @returns {Promise<void>}
 */
export async function renderNodeChildren(viewEngine, element, node, data, actorId) {
  // Handle children
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      // Reject $if in children (removed - use data-attributes + CSS instead)
      if (child && typeof child === 'object' && child.$if) {
        throw new Error('[ViewEngine] "$if" is no longer supported in view templates. Use data-attributes and CSS instead.');
      }
      // Normal child node
      const childElement = await renderNode(viewEngine, child, data, actorId);
      if (childElement) {
        element.appendChild(childElement);
      }
    }
  }
}

/**
 * Render a single node (recursive)
 * @param {Object} viewEngine - ViewEngine instance
 * @param {Object} node - The node definition
 * @param {Object} data - The data context { context, item }
 * @param {string} actorId - The actor ID
 * @returns {Promise<HTMLElement|null>} The rendered element
 */
export async function renderNode(viewEngine, node, data, actorId) {
  if (!node) return null;

  // Create element
  const tag = node.tag || 'div';
  const element = document.createElement(tag);

  // Apply attributes (class, attrs, value, text)
  await applyNodeAttributes(viewEngine, element, node, data, actorId);

  // Handle $each operation
  if (node.$each) {
    // Clear existing children before rendering new items (prevents duplicates on re-render)
    element.innerHTML = '';
    const fragment = await viewEngine.renderEach(node.$each, data, actorId);
    element.appendChild(fragment);
  }

  // Handle events
  if (node.$on) {
    viewEngine.attachEvents(element, node.$on, data, actorId);
  }

  // Handle $slot property: { $slot: "$key" }
  // If node has $slot property, render slot content into the element and return early
  if (node.$slot) {
    await viewEngine._renderSlot(node, data, element, actorId);
    return element;
  }

  // Reject old slot syntax (migrated to $slot)
  if (node.slot) {
    throw new Error('[ViewEngine] Old "slot" syntax is no longer supported. Use "$slot" instead.');
  }

  // Render children
  await renderNodeChildren(viewEngine, element, node, data, actorId);

  return element;
}

/**
 * Render a $each loop
 * @param {Object} viewEngine - ViewEngine instance
 * @param {Object} eachDef - The $each definition { items, template }
 * @param {Object} data - The data context
 * @param {string} actorId - The actor ID
 * @returns {Promise<DocumentFragment>} Fragment containing all rendered items
 */
export async function renderEach(viewEngine, eachDef, data, actorId) {
  const fragment = document.createDocumentFragment();
  
  // Evaluate items
  const items = await viewEngine.evaluator.evaluate(eachDef.items, data);
  
  if (!Array.isArray(items) || items.length === 0) {
    return fragment;
  }

  // Render each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemData = {
      context: data.context,
      item: item,
      index: i
    };
    
    const itemElement = await renderNode(viewEngine, eachDef.template, itemData, actorId);
    if (itemElement) {
      fragment.appendChild(itemElement);
    }
  }

  return fragment;
}
