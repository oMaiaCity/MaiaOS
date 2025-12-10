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
 * Uses state machine for loading state management
 */
export function extractCoValueProperties(coValue: any): ExtractedCoValueProperties | null {
  if (!coValue || !coValue.$jazz) {
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
    const data: Record<string, any> = {};
    let keys: string[] = [];

    // Get all keys from the CoValue
    try {
      keys = Object.keys(coValue).filter((key) => key !== "$jazz" && key !== "$isLoaded");
      if (keys.length === 0 && coValue.$jazz && typeof coValue.$jazz.keys === "function") {
        keys = Array.from(coValue.$jazz.keys());
      }
    } catch (e) {
      console.warn("Error getting CoValue keys:", e);
    }

    // Extract all properties
    for (const key of keys) {
      try {
        const value = coValue[key];

        if (key.startsWith("$") || key === "constructor") {
          continue;
        }

        // Handle ImageDefinition FileStream properties
        if (isImageDef && (key === "original" || /^\d+x\d+$/.test(key))) {
          if (value && typeof value === "object" && value.$jazz) {
            try {
              let fileStreamId = "unknown";
              let mimeType = "unknown";
              let size = 0;
              try {
                fileStreamId = value.$jazz?.id || "unknown";
                if (typeof (value as any).getMimeType === "function") {
                  mimeType = (value as any).getMimeType() || "unknown";
                }
                if (typeof (value as any).getSize === "function") {
                  size = (value as any).getSize() || 0;
                }
              } catch (e) {
                console.warn(`Error accessing FileStream metadata for ${key}:`, e);
              }

              data[key] = {
                type: "FileStream",
                id: fileStreamId,
                isLoaded: value.$isLoaded || false,
                mimeType,
                size,
                fileStream: value,
                coValue: value,
              };
              continue;
            } catch (e) {
              console.warn(`Error extracting FileStream ${key}:`, e);
            }
          }
        }

        // Handle different value types
        if (value && typeof value === "object" && "$jazz" in value) {
          if (isCoList(value)) {
            // CoList
            const items: any[] = [];
            try {
              const listArray = Array.from(value);
              items.push(
                ...listArray.map((item, index) => {
                  const itemAny = item as any;
                  if (item && typeof item === "object" && "$jazz" in item) {
                    return {
                      index,
                      type: "CoValue",
                      id: itemAny.$jazz?.id || "unknown",
                      isLoaded: itemAny.$isLoaded || false,
                      preview: getDisplayLabel(itemAny) || "Loading...",
                      item: item,
                    };
                  } else {
                    return {
                      index,
                      type: "primitive",
                      value: item,
                    };
                  }
                }),
              );
            } catch (e) {
              items.push({ error: `Error iterating list: ${String(e)}` });
            }

            data[key] = {
              type: "CoList",
              id: value.$jazz?.id || "unknown",
              isLoaded: value.$isLoaded || false,
              length: items.length,
              items: items,
              coValue: value,
            };
          } else {
            // CoMap or other CoValue - extract nested properties
            const nestedProperties = extractNestedProperties(value, key);
            const nestedCoMapMetadata = value.$isLoaded
              ? (() => {
                  try {
                    const metadata = extractCoValueProperties(value);
                    return metadata?.jazzMetadata || null;
                  } catch (error) {
                    console.warn(`Error extracting metadata for nested CoMap ${key}:`, error);
                    return null;
                  }
                })()
              : null;

            data[key] = {
              type: "CoMap",
              id: value.$jazz?.id || "unknown",
              isLoaded: value.$isLoaded || false,
              properties: nestedProperties,
              value: value.$isLoaded ? String(value) : "Loading...",
              jazzMetadata: nestedCoMapMetadata,
              coValue: value,
            };
          }
        } else if (value !== undefined && value !== null) {
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
 */
function extractNestedProperties(value: any, parentKey: string): Record<string, any> {
  const nestedProperties: Record<string, any> = {};

  if (!value.$isLoaded) {
    return nestedProperties;
  }

  try {
    let nestedKeys: string[] = [];
    if (value.$jazz && typeof value.$jazz.keys === "function") {
      nestedKeys = Array.from(value.$jazz.keys());
    } else {
      nestedKeys = Object.keys(value).filter(
        (k) => !k.startsWith("$") && k !== "constructor",
      );
    }

    // Special handling for avatar CoMap
    if (parentKey === "avatar") {
      try {
        const imageValue = (value as any).image;
        if (imageValue !== undefined && imageValue !== null && !nestedKeys.includes("image")) {
          nestedKeys.push("image");
        }
      } catch (e) {
        // Ignore errors
      }
    }

    // Extract nested properties
    for (const nestedKey of nestedKeys) {
      try {
        const nestedValue = value[nestedKey];

        if (nestedValue === undefined || nestedValue === null) {
          continue;
        }

        if (nestedValue && typeof nestedValue === "object" && nestedValue.$jazz) {
          const parentIsImageDef = isImageDefinition(value);
          let isFileStreamValue = false;

          // Check if it's a FileStream
          if (parentIsImageDef && (nestedKey === "original" || /^\d+x\d+$/.test(nestedKey))) {
            isFileStreamValue = true;
          } else {
            isFileStreamValue = isFileStream(nestedValue);
          }

          if (isFileStreamValue) {
            let fileStreamId = "unknown";
            let mimeType = "unknown";
            let size = 0;
            try {
              fileStreamId = nestedValue.$jazz?.id || "unknown";
              if (typeof (nestedValue as any).getMimeType === "function") {
                mimeType = (nestedValue as any).getMimeType() || "unknown";
              }
              if (typeof (nestedValue as any).getSize === "function") {
                size = (nestedValue as any).getSize() || 0;
              }
            } catch (e) {
              console.warn(`Error accessing FileStream metadata for ${nestedKey}:`, e);
            }

            nestedProperties[nestedKey] = {
              type: "FileStream",
              id: fileStreamId,
              isLoaded: nestedValue.$isLoaded || false,
              mimeType,
              size,
              fileStream: nestedValue,
              coValue: nestedValue,
            };
          } else if (isImageDefinition(nestedValue)) {
            let imageId = "unknown";
            try {
              imageId = nestedValue.$jazz?.id || "unknown";
            } catch (e) {
              // Try alternative methods
              try {
                imageId = (nestedValue as any).id || "unknown";
              } catch (e2) {
                // Ignore
              }
            }

            nestedProperties[nestedKey] = {
              type: "ImageDefinition",
              id: imageId,
              isLoaded: nestedValue.$isLoaded || false,
              imageDefinition: nestedValue,
              coValue: nestedValue,
              rawValue: nestedValue,
            };
          } else {
            nestedProperties[nestedKey] = {
              type: "CoValue",
              id: nestedValue.$jazz?.id || "unknown",
              isLoaded: nestedValue.$isLoaded || false,
              value: nestedValue.$isLoaded ? String(nestedValue) : "Loading...",
              coValue: nestedValue,
            };
          }
        } else {
          nestedProperties[nestedKey] = nestedValue;
        }
      } catch (error) {
        console.warn(`Error accessing nested property ${nestedKey}:`, error);
      }
    }
  } catch (e) {
    console.warn(`Error extracting nested properties from ${parentKey}:`, e);
  }

  return nestedProperties;
}

/**
 * Extract root data (for root CoMap)
 */
export function extractRootData(root: any): Record<string, any> {
  const data: Record<string, any> = {};
  let keys: string[] = [];

  try {
    keys = Object.keys(root).filter((key) => key !== "$jazz" && key !== "$isLoaded");
    if (keys.length === 0 && root.$jazz && typeof root.$jazz.keys === "function") {
      keys = Array.from(root.$jazz.keys());
    }
  } catch (e) {
    console.warn("Error getting root keys:", e);
  }

  for (const key of keys) {
    try {
      const value = (root as any)[key];

      if (key.startsWith("$") || key === "constructor") {
        continue;
      }

      if (value && typeof value === "object" && "$jazz" in value) {
        if (isCoList(value)) {
          const items: any[] = [];
          try {
            const listArray = Array.from(value);
            items.push(
              ...listArray.map((item, index) => {
                const itemAny = item as any;
                if (item && typeof item === "object" && "$jazz" in item) {
                  return {
                    index,
                    type: "CoValue",
                    id: itemAny.$jazz?.id || "unknown",
                    isLoaded: itemAny.$isLoaded || false,
                    preview: getDisplayLabel(itemAny) || "Loading...",
                    item: item,
                  };
                } else {
                  return {
                    index,
                    type: "primitive",
                    value: item,
                  };
                }
              }),
            );
          } catch (e) {
            items.push({ error: `Error iterating list: ${String(e)}` });
          }

          data[key] = {
            type: "CoList",
            id: value.$jazz?.id || "unknown",
            isLoaded: value.$isLoaded || false,
            length: items.length,
            items: items,
            coValue: value,
          };
        } else {
          // CoMap
          const nestedProperties = extractNestedProperties(value, key);
          data[key] = {
            type: "CoMap",
            id: value.$jazz?.id || "unknown",
            isLoaded: value.$isLoaded || false,
            properties: nestedProperties,
            coValue: value,
          };
        }
      } else if (value !== undefined && value !== null) {
        data[key] = value;
      }
    } catch (e) {
      data[key] = `[Error accessing: ${String(e)}]`;
    }
  }

  return data;
}

