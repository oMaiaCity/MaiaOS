/**
 * UI Slot Resolver - Resolves data paths to values for UI slots
 * Generic data path resolver supporting dot notation and array access
 */

import type { Data } from "../dataStore";
import type { UISlotMapping, ResolvedUISlot } from "./types";

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

/**
 * Resolve UI slot mappings to resolved slots with data values
 */
export function resolveUISlots(
  data: Data,
  mappings: UISlotMapping[],
): ResolvedUISlot[] {
  return mappings.map((mapping) => {
    const value = resolveDataPath(data, mapping.dataPath);
    
    return {
      slot: mapping.slot,
      value,
      type: mapping.type,
      config: mapping.config,
    };
  });
}

/**
 * Get slot value by slot identifier
 */
export function getSlotValue(
  resolvedSlots: ResolvedUISlot[],
  slotId: string,
): unknown {
  const slot = resolvedSlots.find((s) => s.slot === slotId);
  return slot?.value;
}

/**
 * Check if a slot path matches a pattern (for nested slots like "list.item.text")
 */
export function matchesSlotPattern(slotId: string, pattern: string): boolean {
  // Exact match
  if (slotId === pattern) return true;
  
  // Pattern match (e.g., "list.item.*" matches "list.item.text")
  const patternParts = pattern.split(".");
  const slotParts = slotId.split(".");
  
  if (patternParts.length !== slotParts.length) return false;
  
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === "*") continue;
    if (patternParts[i] !== slotParts[i]) return false;
  }
  
  return true;
}

