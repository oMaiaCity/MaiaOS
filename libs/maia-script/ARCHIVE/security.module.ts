/**
 * MaiaScript Security Module
 * Comprehensive validation and sanitization for untrusted input
 * Migrated from whitelist.ts - Phase 7 Complete
 */

import { maiaScriptModuleRegistry } from './registry'
import type { MaiaScriptModule } from './types'
import securityRules from './security.rules.json'

// Import Tailwind patterns from whitelist.ts
import { TAILWIND_PATTERNS } from './security-patterns'

/**
 * Allowed HTML tags set
 */
const ALLOWED_TAGS = new Set(securityRules.rules.allowedTags)

/**
 * Blocked patterns (regex strings from JSON, compiled here)
 */
const BLOCKED_PATTERNS = securityRules.rules.blockedPatterns.map(
  pattern => new RegExp(pattern, 'i')
)

/**
 * Container query prefixes
 */
const CONTAINER_QUERY_PREFIXES = securityRules.rules.containerQueryPrefixes

/**
 * Media query prefixes (blocked)
 */
const MEDIA_QUERY_PREFIXES = securityRules.rules.mediaQueryPrefixes

/**
 * Allowed pseudo-class prefixes
 */
const ALLOWED_PSEUDO_CLASSES = securityRules.rules.allowedPseudoClasses

/**
 * Check if a tag is allowed
 */
export function isAllowedTag(tag: string): boolean {
  return ALLOWED_TAGS.has(tag.toLowerCase())
}

/**
 * Check if an attribute is allowed for a tag
 */
export function isAllowedAttribute(tag: string, attr: string): boolean {
  const tagLower = tag.toLowerCase()
  const attrLower = attr.toLowerCase()

  // Check universal attributes
  if (securityRules.rules.allowedAttributes._universal.includes(attrLower)) {
    return true
  }

  // Check data-* attributes (universal)
  if (attrLower.startsWith('data-')) {
    return true
  }

  // Check aria-* attributes (universal)
  if (attrLower.startsWith('aria-')) {
    return true
  }

  // Check tag-specific attributes
  const tagAttrs = securityRules.rules.allowedAttributes[tagLower as keyof typeof securityRules.rules.allowedAttributes]
  if (Array.isArray(tagAttrs) && tagAttrs.includes(attrLower)) {
    return true
  }

  return false
}

/**
 * Sanitize attribute value
 */
export function sanitizeAttributeValue(tag: string, attr: string, value: unknown): string {
  const strValue = String(value)

  // Block dangerous patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(strValue)) {
      return ''
    }
  }

  // Special validation for href
  if (attr === 'href' && tag === 'a') {
    // Only allow http, https, mailto, tel, or relative paths
    if (!/^(https?:\/\/|mailto:|tel:|\/|#|\.)/.test(strValue)) {
      return '#'
    }
  }

  // Special validation for src (images)
  if (attr === 'src' && tag === 'img') {
    // Only allow http, https, or data:image
    if (!/^(https?:\/\/|data:image\/)/.test(strValue)) {
      return ''
    }
  }

  return strValue
}

/**
 * Sanitize Tailwind classes - returns both sanitized classes and blocked classes
 */
export function sanitizeClasses(classes: string[]): {
  sanitized: string[]
  blocked: string[]
} {
  const sanitized: string[] = []
  const blocked: string[] = []

  for (const cls of classes) {
    const trimmed = cls.trim()
    if (!trimmed) continue

    // Check if class matches any allowed pattern
    let allowed = false
    let remainingClass = trimmed
    let baseClass = trimmed
    let blockReason: string | null = null

    // ✅ Handle Tailwind important modifier (!) prefix first
    if (remainingClass.startsWith('!')) {
      remainingClass = remainingClass.substring(1) // Remove the ! prefix
    }

    // Extract all prefixes and validate them
    let prefixValid = true
    while (remainingClass.includes(':')) {
      const colonIndex = remainingClass.indexOf(':')
      const prefix = remainingClass.substring(0, colonIndex)
      const rest = remainingClass.substring(colonIndex + 1)

      // Check if it's a container query prefix
      if (prefix.startsWith('@')) {
        if (!CONTAINER_QUERY_PREFIXES.includes(prefix)) {
          prefixValid = false
          blockReason = `Unknown container query prefix: ${prefix}`
          break
        }
        remainingClass = rest
        continue
      }

      // Check if it's a blocked media query prefix
      if (MEDIA_QUERY_PREFIXES.includes(prefix)) {
        prefixValid = false
        blockReason = `Media query prefix not allowed (use container queries instead): ${prefix}`
        break
      }

      // Check if it's an allowed pseudo-class prefix
      if (ALLOWED_PSEUDO_CLASSES.includes(prefix)) {
        remainingClass = rest
        continue
      }

      // Unknown prefix - might be part of the base class
      break
    }

    // If we blocked it due to invalid prefix, skip
    if (!prefixValid) {
      blocked.push(trimmed + (blockReason ? ` (${blockReason})` : ''))
      continue
    }

    // Base class is what remains after extracting all prefixes
    baseClass = remainingClass

    // Check base class against patterns
    for (const pattern of TAILWIND_PATTERNS) {
      if (pattern.test(baseClass)) {
        allowed = true
        break
      }
    }

    if (allowed) {
      sanitized.push(trimmed)
    } else {
      blocked.push(trimmed + ` (no matching pattern for: ${baseClass})`)
    }
  }

  return { sanitized, blocked }
}

/**
 * Validate CSS class name
 */
export function validateClass(className: string): boolean {
  const result = sanitizeClasses([className])
  return result.sanitized.length > 0
}

/**
 * Validate data path
 */
export function validateDataPath(path: string): boolean {
  const parts = path.split('.')
  const root = parts[0]

  // Check if root is allowed
  if (!securityRules.rules.allowedDataPaths.includes(root)) {
    return false
  }

  // Check for forbidden path components
  for (const part of parts) {
    if (securityRules.rules.forbiddenDataPaths.includes(part.toLowerCase())) {
      return false
    }
  }

  return true
}

/**
 * Validate a leaf node recursively
 */
export function validateLeaf(node: any, path = 'root'): { valid: boolean; errors?: string[] } {
  const errors: string[] = []

  // If node has @schema, skip validation (will be resolved before validation)
  if (node['@schema']) {
    return { valid: true }
  }

  // Validate tag (required for regular leaves)
  if (!node.tag || typeof node.tag !== 'string') {
    errors.push(`${path}: Missing or invalid tag`)
    return { valid: false, errors }
  }

  // Special handling for "icon" tag
  if (node.tag === 'icon') {
    if (!node.icon || typeof node.icon !== 'object') {
      errors.push(`${path}: Icon tag must have an 'icon' configuration object`)
    } else {
      if (!node.icon.name || typeof node.icon.name !== 'string') {
        errors.push(`${path}: Icon configuration must have a 'name' string property`)
      }
      if (node.icon.classes !== undefined) {
        if (typeof node.icon.classes !== 'string') {
          errors.push(`${path}: Icon classes must be a string (space-separated)`)
        } else {
          const iconClassArray = node.icon.classes.split(/\s+/).filter(Boolean)
          const { blocked } = sanitizeClasses(iconClassArray)
          if (blocked.length > 0) {
            errors.push(`${path}: Some icon classes were blocked: ${blocked.join(', ')}`)
          }
        }
      }
    }
  } else if (!isAllowedTag(node.tag)) {
    errors.push(`${path}: Tag '${node.tag}' is not allowed`)
  }

  // Validate attributes
  if (node.attributes) {
    for (const [attr, value] of Object.entries(node.attributes)) {
      if (!isAllowedAttribute(node.tag, attr)) {
        errors.push(`${path}: Attribute '${attr}' is not allowed on tag '${node.tag}'`)
      } else {
        const sanitized = sanitizeAttributeValue(node.tag, attr, value)
        if (sanitized !== String(value)) {
          errors.push(`${path}: Attribute '${attr}' has unsafe value`)
        }
      }
    }
  }

  // Validate classes
  if (node.classes) {
    if (typeof node.classes !== 'string') {
      errors.push(`${path}: Classes must be a string (space-separated)`)
    } else {
      const classArray = node.classes.split(/\s+/).filter(Boolean)
      const { blocked } = sanitizeClasses(classArray)
      if (blocked.length > 0) {
        errors.push(`${path}: Some classes were blocked: ${blocked.join(', ')}`)
      }
    }
  }

  // Validate bindings
  if (node.bindings?.foreach) {
    if (!node.bindings.foreach.items || typeof node.bindings.foreach.items !== 'string') {
      errors.push(`${path}: foreach.items must be a string data path`)
    }
    if (!node.bindings.foreach.leaf) {
      errors.push(`${path}: foreach.leaf is required`)
    } else {
      const nestedResult = validateLeaf(node.bindings.foreach.leaf, `${path}.foreach.leaf`)
      if (!nestedResult.valid) {
        errors.push(...(nestedResult.errors || []))
      }
    }
  }

  // Validate events
  if (node.events) {
    for (const [eventName, eventConfig] of Object.entries(node.events)) {
      if (!eventConfig || typeof eventConfig !== 'object') {
        errors.push(`${path}: Event '${eventName}' must be an EventConfig object`)
        continue
      }

      const config = eventConfig as any
      if (!config.event || typeof config.event !== 'string') {
        errors.push(`${path}: Event '${eventName}' must have an 'event' string property`)
      }
    }
  }

  // Recursively validate elements
  if (node.elements) {
    node.elements.forEach((element: any, index: number) => {
      if (typeof element === 'object') {
        const elementResult = validateLeaf(element, `${path}.elements[${index}]`)
        if (!elementResult.valid) {
          errors.push(...(elementResult.errors || []))
        }
      }
    })
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Security Module Operations
 */
const securityModule: MaiaScriptModule = {
  name: 'security',
  version: '2.0.0',
  operations: {
    // Validation operations
    '$validateTag': {
      name: '$validateTag',
      evaluate: ([tag]: any[]) => {
        return isAllowedTag(String(tag))
      }
    },

    '$validateAttribute': {
      name: '$validateAttribute',
      evaluate: ([tag, attr]: any[]) => {
        return isAllowedAttribute(String(tag), String(attr))
      }
    },

    '$validateClass': {
      name: '$validateClass',
      evaluate: ([className]: any[]) => {
        return validateClass(String(className))
      }
    },

    '$validateDataPath': {
      name: '$validateDataPath',
      evaluate: ([path]: any[]) => {
        return validateDataPath(String(path))
      }
    },

    // Sanitization operations
    '$sanitizeClasses': {
      name: '$sanitizeClasses',
      evaluate: ([classes]: any[]) => {
        if (typeof classes === 'string') {
          const classArray = classes.split(/\s+/).filter(Boolean)
          const result = sanitizeClasses(classArray)
          return result.sanitized.join(' ')
        }
        return ''
      }
    },

    '$sanitizeAttributeValue': {
      name: '$sanitizeAttributeValue',
      evaluate: ([tag, attr, value]: any[]) => {
        return sanitizeAttributeValue(String(tag), String(attr), value)
      }
    }
  }
}

// Auto-register on import
maiaScriptModuleRegistry.register(securityModule)

// securityModule is exported above, other functions are already exported inline
export { securityModule }
