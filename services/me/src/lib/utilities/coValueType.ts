/**
 * CoValue Type Detection - Simplified to use Jazz's native type system
 * 
 * This file consolidates all type detection logic.
 * Uses $jazz.raw.type as the primary source (like Jazz inspector).
 */

import { resolveCoValue, getCoValueDisplayType } from "./coValueResolver.js";
import type { ExtendedCoJsonType } from "./coValueResolver.js";

/**
 * Check if a value is a CoList
 * Uses native type detection first, then fallback checks
 */
export function isCoList(value: any): boolean {
  if (!value || typeof value !== "object" || !value.$jazz) return false;

  // Use native type detection first
  const resolved = resolveCoValue(value);
  if (resolved.type === "colist") return true;

  // Fallback for unloaded CoValues
  try {
    return (
      Array.isArray(value) ||
      (value.length !== undefined && typeof value[Symbol.iterator] === "function")
    );
  } catch (e) {
    return false;
  }
}

/**
 * Check if a value is a CoMap
 * Uses native type detection first, then fallback checks
 */
export function isCoMap(value: any): boolean {
  if (!value || typeof value !== "object" || !value.$jazz) return false;
  if (isCoList(value)) return false; // CoList is not a CoMap

  // Use native type detection first
  const resolved = resolveCoValue(value);
  if (resolved.type === "comap") return true;

  // Fallback for unloaded CoValues
  try {
    const hasKeysMethod = value.$jazz && typeof value.$jazz.keys === "function";
    const isNotArray = !Array.isArray(value);
    const hasNoLength = value.length === undefined;

    if (hasKeysMethod && isNotArray && hasNoLength) {
      return true;
    }

    if (isNotArray && hasNoLength) {
      const hasSetMethod = value.$jazz && typeof value.$jazz.set === "function";
      if (hasSetMethod) return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Check if a value is a FileStream
 * Uses native type detection and method checks
 */
export function isFileStream(value: any): boolean {
  if (!value || typeof value !== "object") return false;

  // Use native type detection first
  const resolved = resolveCoValue(value);
  if (resolved.extendedType === "file") return true;

  // Fallback: check for FileStream-specific methods
  try {
    return (
      typeof value.getChunks === "function" ||
      typeof value.toBlob === "function" ||
      typeof value.isBinaryStreamEnded === "function"
    );
  } catch (e) {
    return false;
  }
}

/**
 * Check if a value is an ImageDefinition
 * Uses native type detection and snapshot structure
 */
export function isImageDefinition(value: any): boolean {
  if (!value || typeof value !== "object") return false;

  // Use native type detection first
  const resolved = resolveCoValue(value);
  if (resolved.extendedType === "image") return true;

  // Fallback: check snapshot structure
  try {
    if (value.$isLoaded && resolved.snapshot) {
      return isBrowserImage(resolved.snapshot);
    }

    // Check for ImageDefinition properties
    const hasOriginalSize = value.originalSize !== undefined;
    const hasPlaceholder = value.placeholderDataURL !== undefined;
    const hasOriginal = value.original !== undefined;
    return hasOriginalSize || (hasPlaceholder && hasOriginal);
  } catch (e) {
    return false;
  }
}

/**
 * Helper for ImageDefinition check
 */
function isBrowserImage(snapshot: Record<string, any>): boolean {
  return "originalSize" in snapshot && "placeholderDataURL" in snapshot;
}

/**
 * Get CoValue type string
 * Uses resolveCoValue() for accurate type detection
 */
export function getCoValueType(value: any): ExtendedCoJsonType | "CoValue" {
  if (!value || typeof value !== "object" || !value.$jazz) {
    return "CoValue";
  }

  const resolved = resolveCoValue(value);
  return resolved.extendedType || "CoValue";
}

/**
 * Get schema name for a CoValue (for SchemaDefinition detection)
 * Consolidated from schemaDetector.ts
 */
export function getSchemaName(coValue: any): string {
  if (!coValue) {
    return "CoValue";
  }

  // If not loaded, return basic type
  if (!coValue.$isLoaded) {
    return isCoList(coValue) ? "CoList" : "CoValue";
  }

  // Only CoMaps have $jazz.has method
  if (coValue.$jazz?.has && typeof coValue.$jazz.has === "function") {
    if (coValue.$jazz.has("@schema")) {
      const schemaRef = coValue["@schema"];

      // If @schema is a CoValue reference (like SchemaDefinition), extract its name
      if (schemaRef && typeof schemaRef === "object" && "$jazz" in schemaRef) {
        // If it's loaded, try to get the name
        if (schemaRef.$isLoaded && schemaRef.name) {
          return schemaRef.name;
        }
        // If not loaded, return a generic type
        return "Schema";
      }

      // If it's already a string, return it
      if (typeof schemaRef === "string") {
        return schemaRef;
      }
    }
  }

  // Use type detection for fallback
  const type = getCoValueType(coValue);
  if (type === "CoList") {
    return "CoList";
  }

  // Fallback
  return "CoValue";
}

/**
 * Check if a CoValue has a specific schema
 */
export function hasSchema(coValue: any, schemaName: string): boolean {
  return getSchemaName(coValue) === schemaName;
}






