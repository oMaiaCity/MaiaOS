/**
 * View Resolver - Resolves data paths to values for view nodes
 * Generic data path resolver supporting dot notation and array access
 */

import type { Data } from "../dataStore";

/**
 * Resolve a data path to a value
 * Supports dot notation: "data.title", "data.todos.0.text", etc.
 */
export function resolveDataPath(data: Data, path: string): unknown {
  const parts = path.split(".");
  
  // Remove "data" prefix if present (data.title -> title)
  const dataParts = parts[0] === "data" ? parts.slice(1) : parts;
  
  let current: unknown = data;
  
  for (const part of dataParts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    // Handle array index access (e.g., "todos.0.text")
    const arrayIndexMatch = part.match(/^(\d+)$/);
    if (arrayIndexMatch && Array.isArray(current)) {
      const index = parseInt(arrayIndexMatch[1], 10);
      current = current[index];
    } else if (typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  
  return current;
}

