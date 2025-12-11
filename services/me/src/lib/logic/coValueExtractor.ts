/**
 * CoValue Extractor - Complex logic for extracting CoValue properties
 * Uses state machine for loading states and utilities for type detection
 */

import { createMachine, StateMachine, commonStates, commonEvents } from './stateMachine.js';
import { isCoList, isCoMap, isFileStream, isImageDefinition } from '../utilities/coValueDetector.js';
import { getDisplayLabel } from '../utilities/coValueFormatter.js';
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
 * Extract all properties from a CoValue instance
 * Simplified to use $jazz.raw.toJSON() like the Jazz inspector
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

  // CRITICAL: Use $jazz.raw.toJSON() to get all properties (like Jazz inspector does)
  // The inspector uses value.toJSON() where value is a RawCoValue
  // In our case, coValue is a Jazz proxy, so we need to access $jazz.raw first
  // This is the ONLY reliable way to get all properties, including dynamically created ones
  let jsonSnapshot: Record<string, any> | null = null;
  try {
    if (!coValue.$jazz?.raw || typeof coValue.$jazz.raw.toJSON !== "function") {
      console.warn("[CoValue Extractor] CoValue does not have $jazz.raw.toJSON() method");
      return null;
    }
    jsonSnapshot = coValue.$jazz.raw.toJSON() as Record<string, any>;
  } catch (e) {
    console.warn("[CoValue Extractor] Error calling $jazz.raw.toJSON():", e);
    return null;
  }

  // Create state machine for extraction process
  const machine = createMachine(
    {
      initial: commonStates.idle,
      states: {
        [commonStates.idle]: {
          on: {
            [commonEvents.LOAD]: commonStates.loading,
          },
        },
        [commonStates.loading]: {
          on: {
            [commonEvents.SUCCESS]: commonStates.loaded,
            [commonEvents.ERROR]: commonStates.error,
          },
        },
        [commonStates.loaded]: {},
        [commonStates.error]: {},
      },
    },
    { coValue },
  );

  machine.send(commonEvents.LOAD);

  try {
    const isImageDef = isImageDefinition(coValue);
    // Check if this is a SchemaDefinition (has @schema field with value "schema-definition")
    const isSchemaDefinition = jsonSnapshot["@schema"] === "schema-definition";
    const data: Record<string, any> = {};

    // Extract keys from JSON snapshot (this includes all properties!)
    // The snapshot from $jazz.raw.toJSON() contains ALL properties, including dynamically created ones
    let keys = Object.keys(jsonSnapshot).filter((key) => !key.startsWith("$") && key !== "constructor");

    // SPECIAL CASE: For ImageDefinition, filter to only include ImageDefinition-specific properties
    // This prevents mixing in properties from parent objects
    if (isImageDef) {
      const imageDefProperties = [
        "originalSize",
        "placeholderDataURL",
        "original",
        // Dimension-based FileStreams (e.g., "512x512", "256x256")
      ];
      // Filter keys to only include ImageDefinition properties and dimension-based FileStreams
      keys = keys.filter((key) => {
        // Include known ImageDefinition properties
        if (imageDefProperties.includes(key)) return true;
        // Include dimension-based FileStreams (pattern: "512x512", "256x256", etc.)
        if (/^\d+x\d+$/.test(key)) return true;
        // Exclude everything else (like LASTNAME, INBOX, etc.)
        return false;
      });
    }

    // Extract all properties from snapshot
    for (const key of keys) {
      try {
        if (key.startsWith("$") || key === "constructor") {
          continue;
        }

        // Get value from JSON snapshot (like Jazz inspector does!)
        const value = jsonSnapshot[key];

        // Skip if value is undefined or null
        if (value === undefined || value === null) {
          continue;
        }

        // SPECIAL CASE: SchemaDefinition's "definition" property
        // This is a JSON Schema object (plain object) that should be navigable
        // Store it as the plain object itself so PropertyItem can detect it as an object
        if (isSchemaDefinition && key === "definition") {
          if (value && typeof value === "object" && !Array.isArray(value)) {
            // Store as plain object - PropertyItem will detect it as type "object" and enable navigation
            data[key] = value;
            continue;
          }
        }

        // Handle ImageDefinition FileStream properties
        if (isImageDef && (key === "original" || /^\d+x\d+$/.test(key))) {
          // CRITICAL: For FileStreams, we need the actual CoValue object (not just CoID from snapshot)
          // to access FileStream methods like getMimeType() and getSize()
          // Try to access the property directly from the CoValue (not snapshot)
          let fileStreamCoValue: any = null;
          let mimeType = "unknown";
          let size = 0;

          try {
            // Access the actual CoValue object directly (not from JSON snapshot)
            const fileStreamValue = coValue[key];
            if (fileStreamValue && typeof fileStreamValue === "object" && fileStreamValue.$jazz) {
              fileStreamCoValue = fileStreamValue;

              // Try to get FileStream metadata if loaded
              if (fileStreamCoValue.$isLoaded) {
                try {
                  if (typeof (fileStreamCoValue as any).getMimeType === "function") {
                    mimeType = (fileStreamCoValue as any).getMimeType() || "unknown";
                  }
                  if (typeof (fileStreamCoValue as any).getSize === "function") {
                    size = (fileStreamCoValue as any).getSize() || 0;
                  }
                } catch (e) {
                  // FileStream methods might not be available yet
                }
              }
            }
          } catch (e) {
            // If direct access fails, fall back to CoID from snapshot
          }

          // Use CoID from snapshot if we don't have the CoValue object
          const fileStreamId = fileStreamCoValue?.$jazz?.id || (typeof value === "string" && value.startsWith("co_") ? value : "unknown");

          data[key] = {
            type: "FileStream",
            id: fileStreamId,
            isLoaded: fileStreamCoValue ? fileStreamCoValue.$isLoaded : false,
            mimeType,
            size,
            coValueId: fileStreamId,
            coValue: fileStreamCoValue, // Store actual CoValue for FileStream methods
          };
          continue;
        }

        // Handle ImageDefinition originalSize array
        if (isImageDef && key === "originalSize" && Array.isArray(value)) {
          // originalSize is [width, height] - display as array
          // Store as primitive array so PropertyItem can display it correctly
          data[key] = value; // Store as plain array - PropertyItem will detect it as type "array"
          continue;
        }

        // Handle different value types
        // Note: In JSON snapshot, CoValue references are CoIDs (strings), not CoValue objects
        if (typeof value === "string" && value.startsWith("co_")) {
          // It's a CoID reference - try to access the actual CoValue object from the parent
          let actualCoValue: any = null;
          let detectedType: string = "CoValue";
          let isLoading = false;

          try {
            // Try to access the actual property from the CoValue
            const propertyValue = coValue[key];

            if (propertyValue && typeof propertyValue === "object" && propertyValue.$jazz) {
              actualCoValue = propertyValue;

              // Use Jazz's native type detection from the raw CoValue (like Jazz inspector)
              const nativeType = propertyValue.$jazz?.raw?.type;

              if (nativeType === "colist") {
                detectedType = "CoList";
              } else if (nativeType === "comap") {
                // Check if it's a special CoMap type
                if (isImageDefinition(propertyValue)) {
                  detectedType = "ImageDefinition";
                } else {
                  detectedType = "CoMap";
                }
              } else if (nativeType === "costream") {
                // CoStream can be FileStream, CoPlainText, CoRichText
                if (isFileStream(propertyValue)) {
                  detectedType = "FileStream";
                } else {
                  // Check for text types
                  const snapshot = propertyValue.$jazz?.raw?.toJSON?.();
                  if (snapshot && typeof snapshot === "string") {
                    detectedType = "CoPlainText";
                  } else {
                    detectedType = "CoStream";
                  }
                }
              } else {
                // Check if it's a CoFeed (has perAccount, perSession, etc.)
                if (propertyValue.perAccount || propertyValue.perSession || propertyValue.byMe) {
                  detectedType = "CoFeed";
                } else {
                  detectedType = "CoValue";
                }
              }
            } else {
              // Property is not yet loaded - mark as loading
              isLoading = true;
            }
          } catch (e) {
            // If we can't access the property, it's likely still loading
            isLoading = true;
          }

          // Store with detected type and actual CoValue for navigation
          // If loading, store with isLoading flag
          if (isLoading) {
            // Property is still loading - store with loading state
            data[key] = {
              type: "CoValue",
              id: value,
              isLoaded: false,
              isLoading: true,
              coValueId: value,
            };
            continue; // Skip to next property
          }
          
          // Property is loaded - store with detected type
          if (detectedType === "CoList" && actualCoValue) {
            let length = 0;
            if (actualCoValue.$isLoaded) {
              try {
                length = Array.from(actualCoValue).length;
              } catch (e) {
                // If we can't get length, default to 0
              }
            }
            data[key] = {
              type: "CoList",
              id: value,
              isLoaded: actualCoValue.$isLoaded || false,
              length: length,
              coValue: actualCoValue, // Store the actual CoList for navigation
              coValueId: value,
            };
          } else if (detectedType === "CoMap" && actualCoValue) {
            data[key] = {
              type: "CoMap",
              id: value,
              isLoaded: actualCoValue.$isLoaded || false,
              coValue: actualCoValue, // Store the actual CoMap for navigation
              coValueId: value,
            };
          } else if (detectedType === "CoFeed" && actualCoValue) {
            data[key] = {
              type: "CoFeed",
              id: value,
              isLoaded: actualCoValue.$isLoaded || false,
              coValue: actualCoValue, // Store the actual CoFeed for navigation
              coValueId: value,
            };
          } else {
            // Generic CoValue reference (or we couldn't access the actual object)
            data[key] = {
              type: detectedType,
              id: value,
              isLoaded: actualCoValue ? actualCoValue.$isLoaded || false : false,
              coValueId: value,
              coValue: actualCoValue, // Store if we have it (makes it navigatable)
            };
          }
        } else if (value && typeof value === "object" && Array.isArray(value)) {
          // Check if it's a CoList (array of CoIDs) or a primitive array
          // CoLists in JSON snapshot are arrays of CoID strings
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
              id: "unknown", // CoList ID not available in snapshot
              isLoaded: false,
              length: items.length,
              items: items,
            };
          } else {
            // Primitive array (like originalSize: [512, 512])
            // Store as plain array - PropertyItem will detect it as type "array"
            data[key] = value;
          }
        } else if (value && typeof value === "object" && !Array.isArray(value)) {
          // Nested JSON object from snapshot - this is a passthrough object (plain object)
          // Store it the same way as SchemaDefinition.definition - as plain object directly
          // This makes ALL passthrough objects navigatable consistently
          data[key] = value;
        } else {
          // Primitive value (string, number, boolean, etc.)
          data[key] = value;
        }
      } catch (e) {
        data[key] = `[Error accessing: ${String(e)}]`;
      }
    }

    machine.send(commonEvents.SUCCESS);

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
  } catch (error) {
    machine.send(commonEvents.ERROR, error);
    console.error("Error extracting CoValue properties:", error);
    return null;
  }
}

/**
 * Extract nested properties from a CoMap
 * Simplified to use $jazz.raw.toJSON() like the Jazz inspector
 * Note: This handles nested JSON objects from the snapshot, not CoValue references
 */
function extractNestedProperties(value: any, parentKey: string): Record<string, any> {
  const nestedProperties: Record<string, any> = {};

  // If value is a CoValue object (has $jazz), use its raw.toJSON()
  if (value && typeof value === "object" && value.$jazz && value.$isLoaded) {
    try {
      if (value.$jazz?.raw && typeof value.$jazz.raw.toJSON === "function") {
        const nestedSnapshot = value.$jazz.raw.toJSON() as Record<string, any>;
        const nestedKeys = Object.keys(nestedSnapshot).filter(
          (k) => !k.startsWith("$") && k !== "constructor"
        );

        for (const nestedKey of nestedKeys) {
          try {
            const nestedValue = nestedSnapshot[nestedKey];
            if (nestedValue === undefined || nestedValue === null) {
              continue;
            }

            // Handle nested values (CoIDs, primitives, nested objects)
            if (typeof nestedValue === "string" && nestedValue.startsWith("co_")) {
              nestedProperties[nestedKey] = {
                type: "CoValue",
                id: nestedValue,
                isLoaded: false,
                coValueId: nestedValue,
              };
            } else if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
              nestedProperties[nestedKey] = {
                type: "object",
                value: nestedValue,
              };
            } else {
              nestedProperties[nestedKey] = nestedValue;
            }
          } catch (error) {
            console.warn(`Error accessing nested property ${nestedKey}:`, error);
          }
        }
      }
    } catch (e) {
      console.warn(`Error extracting nested properties from ${parentKey}:`, e);
    }
  } else if (value && typeof value === "object" && !Array.isArray(value) && !value.$jazz) {
    // It's a plain JSON object from the snapshot
    const nestedKeys = Object.keys(value).filter(
      (k) => !k.startsWith("$") && k !== "constructor"
    );

    for (const nestedKey of nestedKeys) {
      try {
        const nestedValue = value[nestedKey];
        if (nestedValue === undefined || nestedValue === null) {
          continue;
        }

        nestedProperties[nestedKey] = nestedValue;
      } catch (error) {
        console.warn(`Error accessing nested property ${nestedKey}:`, error);
      }
    }
  }

  return nestedProperties;
}

/**
 * Extract root data (for root CoMap)
 * Simplified to use $jazz.raw.toJSON() like the Jazz inspector
 */
export function extractRootData(root: any): Record<string, any> {
  const data: Record<string, any> = {};

  if (!root || !root.$jazz || !root.$isLoaded) {
    return data;
  }

  try {
    // Use $jazz.raw.toJSON() to get all properties
    let jsonSnapshot: Record<string, any> | null = null;
    if (root.$jazz?.raw && typeof root.$jazz.raw.toJSON === "function") {
      jsonSnapshot = root.$jazz.raw.toJSON() as Record<string, any>;
    } else {
      return data;
    }

    const keys = Object.keys(jsonSnapshot).filter((key) => key !== "$jazz" && key !== "$isLoaded");

    for (const key of keys) {
      try {
        const value = jsonSnapshot[key];

        if (key.startsWith("$") || key === "constructor") {
          continue;
        }

        if (typeof value === "string" && value.startsWith("co_")) {
          // CoID reference
          data[key] = {
            type: "CoValue",
            id: value,
            isLoaded: false,
            coValueId: value,
          };
        } else if (value && typeof value === "object" && Array.isArray(value)) {
          // CoList
          const items: any[] = value.map((item, index) => {
            if (typeof item === "string" && item.startsWith("co_")) {
              return {
                index,
                type: "CoValue",
                id: item,
                isLoaded: false,
                coValueId: item,
              };
            } else {
              return {
                index,
                type: "primitive",
                value: item,
              };
            }
          });

          data[key] = {
            type: "CoList",
            id: "unknown",
            isLoaded: false,
            length: items.length,
            items: items,
          };
        } else if (value !== undefined && value !== null) {
          data[key] = value;
        }
      } catch (e) {
        data[key] = `[Error accessing: ${String(e)}]`;
      }
    }
  } catch (e) {
    console.warn("Error getting root keys:", e);
  }

  return data;
}
