/**
 * MaiaScript Security Module
 * Provides validation and sanitization for untrusted input
 * Phase 7: Security Validation Module
 */

import { maiaScriptModuleRegistry } from './registry'
import type { MaiaScriptModule } from './types'
import securityRules from './security.rules.json'

/**
 * Validate HTML tag
 */
function validateTag(tag: string): boolean {
  return securityRules.rules.allowedTags.includes(tag.toLowerCase())
}

/**
 * Validate HTML attribute
 */
function validateAttribute(attr: string): boolean {
  return securityRules.rules.allowedAttributes.includes(attr.toLowerCase())
}

/**
 * Validate CSS class name
 */
function validateClass(className: string): boolean {
  // Check forbidden classes
  if (securityRules.rules.forbiddenClasses.includes(className.toLowerCase())) {
    return false
  }
  
  // Check against allowed patterns
  for (const pattern of securityRules.rules.allowedClassPatterns) {
    const regex = new RegExp(pattern)
    if (regex.test(className)) {
      return true
    }
  }
  
  return false
}

/**
 * Sanitize class names (filter out invalid ones)
 */
function sanitizeClasses(classes: string): string {
  return classes
    .split(/\s+/)
    .filter(cls => cls && validateClass(cls))
    .join(' ')
}

/**
 * Validate data path
 */
function validateDataPath(path: string): boolean {
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
 * Security Module Operations
 */
const securityModule: MaiaScriptModule = {
  name: 'security',
  version: '1.0.0',
  operations: {
    // Validation operations
    '$validateTag': {
      name: '$validateTag',
      evaluate: ([tag]: any[]) => {
        return validateTag(String(tag))
      }
    },
    
    '$validateAttribute': {
      name: '$validateAttribute',
      evaluate: ([attr]: any[]) => {
        return validateAttribute(String(attr))
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
        return sanitizeClasses(String(classes))
      }
    }
  }
}

// Auto-register on import
maiaScriptModuleRegistry.register(securityModule)

// Export validation functions for use in ViewEngine
export { 
  securityModule,
  validateTag,
  validateAttribute,
  validateClass,
  sanitizeClasses,
  validateDataPath
}
