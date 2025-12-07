/**
 * CoValue Detector Utilities - Type detection functions
 * Simple boolean checks to determine CoValue types
 */

/**
 * Check if a value is a CoList
 */
export function isCoList(value: any): boolean {
  if (!value || typeof value !== "object") return false;

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
 */
export function isCoMap(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  if (isCoList(value)) return false; // CoList is not a CoMap

  try {
    const hasKeysMethod = value.$jazz && typeof value.$jazz.keys === "function";
    const isNotArray = !Array.isArray(value);
    const hasNoLength = value.length === undefined;

    if (hasKeysMethod && isNotArray && hasNoLength) {
      return true;
    }

    // Fallback: check if it has properties via Object.keys
    if (isNotArray && hasNoLength) {
      const objKeys = Object.keys(value).filter(
        (k) => !k.startsWith("$") && k !== "constructor",
      );
      return objKeys.length > 0;
    }

    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Check if a value is a FileStream
 */
export function isFileStream(value: any): boolean {
  if (!value || typeof value !== "object") return false;

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
 */
export function isImageDefinition(value: any): boolean {
  if (!value || typeof value !== "object") return false;

  try {
    const hasOriginalSize = value.originalSize !== undefined;
    const hasPlaceholder = value.placeholderDataURL !== undefined;
    const hasOriginal = value.original !== undefined;
    return hasOriginalSize || (hasPlaceholder && hasOriginal);
  } catch (e) {
    return false;
  }
}

/**
 * Detect CoValue type
 */
export function detectCoValueType(value: any): "CoList" | "CoMap" | "FileStream" | "ImageDefinition" | "CoValue" {
  if (isCoList(value)) return "CoList";
  if (isImageDefinition(value)) return "ImageDefinition";
  if (isFileStream(value)) return "FileStream";
  if (isCoMap(value)) return "CoMap";
  return "CoValue";
}

