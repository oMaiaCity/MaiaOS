/**
 * CoValue Extractor - Simplified property extraction from snapshots only
 * 
 * Follows Jazz inspector pattern: extract everything from toJSON() snapshot.
 * For CoID values, store as CoID strings (don't try to resolve synchronously).
 */

import { resolveCoValue } from './coValueResolver.js';
import { getDisplayLabel } from './coValueFormatter.js';
import { getCoValueGroupInfo } from '@hominio/data';

export interface ExtractedProperty {
  type: string;
  id?: string;
  isLoaded?: boolean;
  value?: any;
  coValue?: any;
  properties?: Record<string, ExtractedProperty>;
  items?: Array<{ index: number; type: string; id?: string; isLoaded?: boolean; preview?: string; item?: any; value?: any }>;
  length?: number;
  mimeType?: string;
  size?: number;
  imageDefinition?: any;
  fileStream?: any;
  rawValue?: any;
}

export interface ExtractedCoValueProperties {
  properties: Record<string, ExtractedProperty | any>;
  jazzMetadata: {
    id: string;
    owner: any;
    ownerInfo: { type: string; id: string } | null;
    keys: string[];
    groupInfo?: {
      groupId: string | null;
      accountMembers: Array<{ id: string; role: string; type: "account" }>;
      groupMembers: Array<{ id: string; role: string; type: "group" }>;
    } | null;
  };
}

/**
 * Extract items from a CoList
 * Iterates the CoList directly to get wrapped CoValues (like the old implementation)
 */
export function extractCoListItems(coList: any): any[] {
  if (!coList || !coList.$isLoaded) return [];

  try {
    const items: any[] = [];
    const listArray = Array.from(coList);
    items.push(
      ...listArray.map((item, index) => {
        const itemAny = item as any;
        if (item && typeof item === "object" && "$jazz" in item) {
          // Use resolveCoValue() to get accurate type (like Jazz inspector)
          const resolved = resolveCoValue(item);
          const displayType = resolved.extendedType || resolved.type || "CoValue";
          // Extract plain values - ensure id is a string, not a function
          const itemId = itemAny.$jazz?.id;
          const plainId = typeof itemId === "string" ? itemId : "unknown";

          return {
            index: index, // Plain number
            type: displayType, // Plain string
            id: plainId, // Plain string
            isLoaded: Boolean(itemAny.$isLoaded), // Plain boolean
            preview: getDisplayLabel(itemAny) || "Loading...", // Plain string
            item: item, // CoValue reference (for navigation)
            coValue: item, // CoValue reference (for navigation)
          };
        } else {
          return {
            index: index, // Plain number
            type: "primitive", // Plain string
            value: item, // Primitive value
          };
        }
      }),
    );
    return items;
  } catch (e) {
    return [];
  }
}

/**
 * Extract all properties from a CoValue instance
 * Works purely from snapshot (like Jazz inspector's GridView)
 */
export function extractCoValueProperties(coValue: any): ExtractedCoValueProperties | null {
  if (!coValue || !coValue.$jazz) {
    return null;
  }

  // Ensure CoValue is loaded before extracting properties
  if (!coValue.$isLoaded) {
    console.warn("[CoValue Extractor] CoValue not loaded, cannot extract properties");
    return null;
  }

  // Use resolveCoValue() to get snapshot and type (like Jazz inspector)
  const resolved = resolveCoValue(coValue);

  if (!resolved.snapshot || resolved.snapshot === "unavailable") {
    console.warn("[CoValue Extractor] Could not get snapshot from CoValue");
    return null;
  }

  const jsonSnapshot = resolved.snapshot;
  const isImageDef = resolved.extendedType === "image";
  const isSchemaDefinition = jsonSnapshot["@schema"] === "schema-definition";
  const data: Record<string, any> = {};

  // Extract keys from JSON snapshot
  let keys = Object.keys(jsonSnapshot).filter((key) => !key.startsWith("$") && key !== "constructor");

  // SPECIAL CASE: For ImageDefinition, filter to only include ImageDefinition-specific properties
  if (isImageDef) {
    const imageDefProperties = ["originalSize", "placeholderDataURL", "original"];
    keys = keys.filter((key) => {
      if (imageDefProperties.includes(key)) return true;
      if (/^\d+x\d+$/.test(key)) return true; // Dimension-based FileStreams
      return false;
    });
  }

  // Extract all properties from snapshot
  for (const key of keys) {
    try {
      if (key.startsWith("$") || key === "constructor") {
        continue;
      }

      const value = jsonSnapshot[key];

      // Skip if value is undefined or null
      if (value === undefined || value === null) {
        continue;
      }

      // Skip functions - they shouldn't be displayed as properties
      if (typeof value === "function") {
        continue;
      }

      // SPECIAL CASE: SchemaDefinition's "definition" property (passthrough object)
      if (isSchemaDefinition && key === "definition") {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          data[key] = value; // Store as plain object for navigation
          continue;
        }
      }

      // Handle ImageDefinition FileStream properties
      if (isImageDef && (key === "original" || /^\d+x\d+$/.test(key))) {
        // FileStream CoID from snapshot
        const fileStreamId = typeof value === "string" && value.startsWith("co_") ? value : "unknown";

        data[key] = {
          type: "FileStream",
          id: fileStreamId,
          isLoaded: false, // Will be loaded on-demand when clicked
          coValueId: fileStreamId,
        };
        continue;
      }

      // Handle ImageDefinition originalSize array
      if (isImageDef && key === "originalSize" && Array.isArray(value)) {
        data[key] = value; // Store as plain array
        continue;
      }

      // Handle CoValue references (CoIDs in snapshot)
      // Try to get wrapped CoValue if already loaded (for root grid display)
      // Otherwise store as CoID string - will be resolved on-demand when clicked
      if (typeof value === "string" && value.startsWith("co_")) {
        // Try to access wrapped CoValue if it's already loaded (common for root properties)
        let wrappedCoValue: any = null;
        try {
          const propertyValue = coValue[key];
          if (propertyValue && typeof propertyValue === "object" && propertyValue.$jazz) {
            wrappedCoValue = propertyValue;
          }
        } catch (e) {
          // Ignore - property might not be accessible
        }

        // If we have a wrapped CoValue, determine its type
        if (wrappedCoValue && wrappedCoValue.$isLoaded) {
          const resolved = resolveCoValue(wrappedCoValue);
          const displayType = resolved.extendedType || resolved.type || "CoValue";

          if (displayType === "CoList" || resolved.type === "colist") {
            data[key] = {
              type: "CoList",
              id: value,
              isLoaded: true,
              length: Array.from(wrappedCoValue).length,
              coValue: wrappedCoValue,
              coValueId: value,
            };
          } else if (displayType === "CoMap" || resolved.type === "comap") {
            data[key] = {
              type: "CoMap",
              id: value,
              isLoaded: true,
              coValue: wrappedCoValue,
              coValueId: value,
            };
          } else {
            data[key] = {
              type: displayType,
              id: value,
              isLoaded: true,
              coValue: wrappedCoValue,
              coValueId: value,
            };
          }
        } else {
          // Generic CoValue - will be resolved on-demand
          data[key] = {
            type: "CoValue",
            id: value,
            isLoaded: false,
            coValueId: value,
          };
        }
        continue;
      }

      // Handle arrays
      if (value && typeof value === "object" && Array.isArray(value)) {
        // Check if it's a CoList (array of CoIDs) or primitive array
        const isCoList = value.length > 0 && value.every((item) => typeof item === "string" && item.startsWith("co_"));

        if (isCoList) {
          // CoList - array of CoIDs
          const items: any[] = value.map((item, index) => {
            return {
              index,
              type: "CoValue",
              id: item,
              isLoaded: false,
              coValueId: item,
            };
          });

          data[key] = {
            type: "CoList",
            id: "unknown",
            isLoaded: false,
            length: items.length,
            items: items,
          };
        } else {
          // Primitive array (like originalSize: [512, 512])
          data[key] = value;
        }
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        // Nested JSON object from snapshot - passthrough object
        data[key] = value; // Store as plain object for navigation
      } else {
        // Primitive value (string, number, boolean, etc.)
        data[key] = value;
      }
    } catch (e) {
      data[key] = `[Error accessing: ${String(e)}]`;
    }
  }

  return {
    properties: data,
    jazzMetadata: {
      id: coValue.$jazz?.id,
      owner: coValue.$jazz?.owner,
      ownerInfo:
        coValue.$jazz?.owner &&
          typeof coValue.$jazz.owner === "object" &&
          "$jazz" in coValue.$jazz.owner
          ? {
            type: "Group",
            id: coValue.$jazz.owner.$jazz?.id || "unknown",
          }
          : null,
      keys: keys,
      groupInfo: (() => {
        try {
          return getCoValueGroupInfo(coValue);
        } catch (error) {
          console.warn("Error getting group info:", error);
          return null;
        }
      })(),
    },
  };
}

/**
 * Extract root data (for root CoMap)
 * Simplified to use extractCoValueProperties
 */
export function extractRootData(root: any): { properties: Record<string, any>; jazzMetadata: any } | null {
  if (!root || !root.$jazz || !root.$isLoaded) {
    return null;
  }

  // Use extractCoValueProperties which already handles everything correctly
  const extracted = extractCoValueProperties(root);
  if (!extracted) {
    return null;
  }

  return {
    properties: extracted.properties,
    jazzMetadata: extracted.jazzMetadata,
  };
}
