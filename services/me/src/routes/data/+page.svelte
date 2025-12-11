<script lang="ts">
  import { JazzAccount, getCoValueGroupInfo, setupComputedFieldsForCoValue } from "@hominio/data";
  import { AccountCoState } from "jazz-tools/svelte";
  import { authClient } from "$lib/auth-client";
  import {
    RootDataDisplay,
    MetadataSidebar,
    CoValueContextDisplay,
    GroupContextView,
    DataLayout,
  } from "$lib/components";
  import ObjectContextDisplay from "$lib/components/composites/ObjectContextDisplay.svelte";
  import { extractCoValueProperties, extractRootData } from "$lib/logic";
  import { Group } from "jazz-tools";

  // Better Auth session
  const session = authClient.useSession();
  const betterAuthUser = $derived($session.data?.user);
  const isBetterAuthSignedIn = $derived(!!betterAuthUser);
  const isBetterAuthPending = $derived($session.isPending);

  // Load Jazz account - Better Auth Jazz plugin automatically sets up the account
  // AccountCoState will use the current account from the Jazz provider
  const account = new AccountCoState(JazzAccount, {
    resolve: {
      profile: true, // Resolve profile to access all its properties
      root: {
        contact: true, // Resolve contact CoMap
        capabilities: true,
        data: true, // Resolve data (list of SchemaDefinitions with entities)
      },
    },
  });
  const me = $derived(account.current);

  // Set up computed fields for profile when it's loaded
  // This ensures name is computed from firstName + lastName
  $effect(() => {
    if (me.$isLoaded && me.profile?.$isLoaded) {
      setupComputedFieldsForCoValue(me.profile);
    }
  });

  // Navigation context type
  type NavigationContext =
    | { type: "root" }
    | { type: "colist"; coValue: any; label: string; parentKey?: string }
    | { type: "covalue"; coValue: any; label: string; parentContext?: NavigationContext }
    | { type: "group"; coValue: any; label: string }
    | { type: "object"; object: any; label: string; parentCoValue: any; parentKey: string };

  // Navigation stack - tracks the path through CoValues
  let navigationStack = $state<NavigationContext[]>([{ type: "root" }]);

  // Current context is the last item in the stack
  const currentContext = $derived(navigationStack[navigationStack.length - 1]);

  // Helper function to get display label for a CoValue
  function getCoValueLabel(coValue: any, fallbackKey?: string): string {
    if (!coValue || !coValue.$isLoaded) {
      return fallbackKey || "Loading...";
    }
    // Try to get @label, but handle cases where has() might not be available
    try {
      if (coValue.$jazz && typeof coValue.$jazz.has === "function" && coValue.$jazz.has("@label")) {
        return coValue["@label"];
      }
    } catch (e) {
      // Ignore errors - fall through to fallback
    }
    // Use fallback key if provided, otherwise use ID
    if (fallbackKey) {
      return fallbackKey;
    }
    try {
      return coValue.$jazz?.id?.slice(0, 8) + "..." || "CoValue";
    } catch (e) {
      return "CoValue";
    }
  }

  // Helper function to check if a co-value is a Group
  function isGroup(coValue: any): boolean {
    if (!coValue || !coValue.$isLoaded) return false;
    try {
      // Check for Group-specific properties
      return (
        "members" in coValue ||
        typeof (coValue as any).getMemberKeys === "function" ||
        typeof (coValue as Group).getParentGroups === "function" ||
        typeof (coValue as Group).myRole === "function"
      );
    } catch (e) {
      return false;
    }
  }

  // Helper function to extract Group from Capability
  async function extractGroupFromCapability(capability: any): Promise<any> {
    if (!capability) return null;
    try {
      // Ensure capability is loaded
      if (!capability.$isLoaded && capability.$jazz?.ensureLoaded) {
        await capability.$jazz.ensureLoaded({ resolve: { group: true } });
      }

      if (!capability.$isLoaded) return null;

      // Check if it's a Capability schema with a group field
      if (capability.$jazz?.has && capability.$jazz.has("group")) {
        let group = capability.group;

        // If group is just an ID (CoID), we need to load it
        if (typeof group === "string") {
          // It's a CoID, need to load the Group
          const { CoState } = await import("jazz-tools/svelte");
          const groupState = new CoState(Group, group);
          group = groupState.current;
        }

        // Ensure group is loaded
        if (group && !group.$isLoaded && group.$jazz?.ensureLoaded) {
          await group.$jazz.ensureLoaded();
        }
        return group;
      }
      // If it's already a Group, return it
      if (isGroup(capability)) {
        // Ensure it's loaded
        if (!capability.$isLoaded && capability.$jazz?.ensureLoaded) {
          await capability.$jazz.ensureLoaded();
        }
        return capability;
      }
      return null;
    } catch (e) {
      console.warn("Error extracting group from capability:", e);
      return null;
    }
  }

  // Navigate to a CoValue (push new context)
  async function navigateToCoValue(coValue: any, label?: string, fallbackKey?: string) {
    // Check if it's a Capability - extract the Group
    const group = await extractGroupFromCapability(coValue);
    if (group) {
      const displayLabel = label || getCoValueLabel(group, fallbackKey || "Group");
      navigationStack = [
        ...navigationStack,
        { type: "group", coValue: group, label: displayLabel },
      ];
      return;
    }

    // Check if it's a Group
    if (isGroup(coValue)) {
      // Ensure Group is loaded
      if (!coValue.$isLoaded && coValue.$jazz?.ensureLoaded) {
        await coValue.$jazz.ensureLoaded();
      }
      const displayLabel = label || getCoValueLabel(coValue, fallbackKey || "Group");
      navigationStack = [...navigationStack, { type: "group", coValue, label: displayLabel }];
      return;
    }

    // Otherwise, treat as regular CoValue
    // Ensure the CoValue and its DIRECT nested CoValue properties are loaded (one level only)
    if (coValue.$jazz?.ensureLoaded) {
      try {
        // First load the CoValue itself to get its structure
        if (!coValue.$isLoaded) {
          await coValue.$jazz.ensureLoaded();
        }

        // Now get the JSON snapshot to find which properties are CoValue references
        const snapshot = coValue.$jazz.raw.toJSON();
        if (snapshot && typeof snapshot === "object") {
          // Build a resolve object for all direct CoValue properties
          const resolveObj: Record<string, true> = {};
          let hasCoValueProps = false;

          for (const [key, value] of Object.entries(snapshot)) {
            // If the value is a CoID string, it's a CoValue reference - we want to load it
            if (typeof value === "string" && value.startsWith("co_")) {
              resolveObj[key] = true; // Load this CoValue so coValue[key] returns the actual CoValue object
              hasCoValueProps = true;
            }
          }

          // If we found any CoValue properties, explicitly load them
          if (hasCoValueProps) {
            await coValue.$jazz.ensureLoaded({ resolve: resolveObj });
          }
        }
      } catch (e) {
        console.warn("Error ensuring CoValue loaded:", e);
      }
    }

    const displayLabel = label || getCoValueLabel(coValue, fallbackKey);
    navigationStack = [...navigationStack, { type: "covalue", coValue, label: displayLabel }];
  }

  // Navigate to a CoList (push new context)
  function navigateToCoList(coList: any, label: string, parentKey?: string) {
    navigationStack = [...navigationStack, { type: "colist", coValue: coList, label, parentKey }];
  }

  // Navigate to an object (push new context)
  function navigateToObject(object: any, label: string, parentCoValue: any, parentKey: string) {
    navigationStack = [
      ...navigationStack,
      { type: "object", object, label, parentCoValue, parentKey },
    ];
  }

  // Navigate back one level
  function navigateBack() {
    if (navigationStack.length > 1) {
      navigationStack = navigationStack.slice(0, -1);
    }
  }

  // Get current CoValue for metadata sidebar (exclude groups - they have their own view)
  // For objects, show parent CoValue metadata
  const selectedCoValue = $derived(() => {
    if (currentContext.type === "root") {
      // Show AppRoot metadata when viewing root
      return me.$isLoaded && me.root ? me.root : null;
    }
    if (currentContext.type === "covalue" || currentContext.type === "colist") {
      return currentContext.coValue;
    }
    if (currentContext.type === "object") {
      // For objects, show parent CoValue metadata
      return currentContext.parentCoValue;
    }
    // Groups don't show metadata sidebar
    return null;
  });

  // Use the extracted logic function
  // Note: The inline function below is kept for backward compatibility during migration
  // TODO: Remove this and use the imported extractCoValueProperties from lib/logic
  function extractCoValuePropertiesInline(coValue: any): {
    properties: Record<string, any>;
    jazzMetadata: {
      id: string;
      owner: any;
      ownerInfo: any;
      keys: string[];
      groupInfo?: {
        groupId: string | null;
        accountMembers: Array<{ id: string; role: string; type: "account" }>;
        groupMembers: Array<{ id: string; role: string; type: "group" }>;
      } | null;
    };
  } | null {
    if (!coValue || !coValue.$jazz) {
      return null;
    }

    // Check if this CoValue itself is an ImageDefinition
    // This is important because properties like original, 512x512, 256x256 are FileStreams
    const isImageDefinition = (() => {
      try {
        if (coValue.$isLoaded) {
          const hasOriginalSize = (coValue as any).originalSize !== undefined;
          const hasPlaceholder = (coValue as any).placeholderDataURL !== undefined;
          const hasOriginal = (coValue as any).original !== undefined;
          return hasOriginalSize || (hasPlaceholder && hasOriginal);
        }
      } catch (e) {
        // Ignore errors
      }
      return false;
    })();

    const data: Record<string, any> = {};
    let keys: string[] = [];

    try {
      // Get all keys from the CoValue
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

        // If this CoValue is an ImageDefinition, certain properties are ALWAYS FileStreams
        // Check this BEFORE handling as a nested CoValue
        if (isImageDefinition && (key === "original" || /^\d+x\d+$/.test(key))) {
          // Properties like original, 512x512, 256x256 in ImageDefinition are FileStreams
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
                console.warn(`[Data Explorer] Error accessing FileStream metadata for ${key}:`, e);
              }

              data[key] = {
                type: "FileStream",
                id: fileStreamId,
                isLoaded: value.$isLoaded || false,
                mimeType,
                size,
                fileStream: value, // Store reference
                coValue: value, // Store reference for navigation
              };

              continue; // Skip to next property
            } catch (e) {
              console.warn(`[Data Explorer] Error extracting FileStream ${key}:`, e);
            }
          }
        }

        // Handle different value types
        if (value && typeof value === "object" && "$jazz" in value) {
          // It's a nested CoValue
          if (
            Array.isArray(value) ||
            (value.length !== undefined && typeof value[Symbol.iterator] === "function")
          ) {
            // CoList
            const items: any[] = [];
            try {
              const listArray = Array.from(value);
              items.push(
                ...listArray.map((item, index) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const itemAny = item as any;
                  if (item && typeof item === "object" && "$jazz" in item) {
                    return {
                      index,
                      type: "CoValue",
                      id: itemAny.$jazz?.id || "unknown",
                      isLoaded: itemAny.$isLoaded || false,
                      preview: itemAny.$isLoaded
                        ? itemAny["@label"] || itemAny.$jazz?.id?.slice(0, 8) || "CoValue"
                        : "Loading...",
                      // Store the full item reference for detailed display
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
              coValue: value, // Store reference to the CoList CoValue for operations
            };
          } else {
            // CoMap or other CoValue - extract nested properties
            const nestedProperties: Record<string, any> = {};
            if (value.$isLoaded) {
              try {
                // Get keys from CoMap - prefer $jazz.keys() as it's more reliable for CoMaps
                let nestedKeys: string[] = [];
                if (value.$jazz && typeof value.$jazz.keys === "function") {
                  nestedKeys = Array.from(value.$jazz.keys());
                } else {
                  // Fallback to Object.keys() if $jazz.keys() not available
                  nestedKeys = Object.keys(value).filter(
                    (k) => !k.startsWith("$") && k !== "constructor",
                  );
                }

                // Special handling for avatar CoMap - try to access image property directly
                // Don't use has() as it causes Proxy errors for ImageDefinition
                if (key === "avatar") {
                  try {
                    // Try to access image directly - if it exists, add to keys
                    const imageValue = (value as any).image;
                    if (
                      imageValue !== undefined &&
                      imageValue !== null &&
                      !nestedKeys.includes("image")
                    ) {
                      nestedKeys.push("image");
                    }
                  } catch (e) {
                    // Ignore errors when accessing image property
                    console.warn(`[Data Explorer] Could not access image property for avatar:`, e);
                  }
                }

                // Extract nested properties
                for (const nestedKey of nestedKeys) {
                  try {
                    // Skip property existence check for now - just try to access it directly
                    // The has() check was causing Proxy errors for ImageDefinition properties
                    // Since we already have the keys from $jazz.keys() or Object.keys(), we know they exist

                    const nestedValue = value[nestedKey];

                    // If the value is undefined/null, skip it
                    if (nestedValue === undefined || nestedValue === null) {
                      continue;
                    }

                    // Handle nested CoValues recursively
                    // Check for $jazz property directly instead of using 'in' operator to avoid Proxy errors
                    if (nestedValue && typeof nestedValue === "object" && nestedValue.$jazz) {
                      // Check if the nested value (value) is an ImageDefinition
                      // This is the parent of nestedKey properties like original, 512x512, etc.
                      const parentIsImageDefinition = (() => {
                        try {
                          // Check if parent value (value) has ImageDefinition properties
                          const hasOriginalSize = (value as any).originalSize !== undefined;
                          const hasPlaceholder = (value as any).placeholderDataURL !== undefined;
                          const hasOriginal = (value as any).original !== undefined;
                          // ImageDefinition always has originalSize when loaded
                          return hasOriginalSize || (hasPlaceholder && hasOriginal);
                        } catch (e) {
                          return false;
                        }
                      })();

                      // Check if it's a FileStream (binary data) - check this FIRST before ImageDefinition
                      // FileStreams have methods like getChunks, toBlob, getMimeType, getSize, isBinaryStreamEnded
                      // IMPORTANT: Check even if not loaded, as FileStreams inside ImageDefinition might not be loaded yet
                      let isFileStream = false;
                      try {
                        // If parent is ImageDefinition, certain properties are ALWAYS FileStreams
                        if (parentIsImageDefinition) {
                          // Properties inside ImageDefinition that are FileStreams:
                          // - "original" (always a FileStream according to docs)
                          // - Numeric patterns like "512x512", "256x256" (progressive loading variants - also FileStreams)
                          if (nestedKey === "original" || /^\d+x\d+$/.test(nestedKey)) {
                            isFileStream = true;
                          }
                        }

                        // Also check for FileStream-specific methods (check even if not loaded - methods might be on prototype)
                        if (!isFileStream) {
                          const hasGetChunks = typeof (nestedValue as any).getChunks === "function";
                          const hasToBlob = typeof (nestedValue as any).toBlob === "function";
                          const hasGetMimeType =
                            typeof (nestedValue as any).getMimeType === "function";
                          const hasGetSize = typeof (nestedValue as any).getSize === "function";
                          const hasIsBinaryStreamEnded =
                            typeof (nestedValue as any).isBinaryStreamEnded === "function";

                          // FileStream has at least getChunks and toBlob
                          isFileStream = hasGetChunks || hasToBlob || hasIsBinaryStreamEnded;
                        }
                      } catch (e) {
                        console.warn(
                          `[Data Explorer] Error checking FileStream for ${nestedKey}:`,
                          e,
                        );
                      }

                      // Check if it's an ImageDefinition (only if not a FileStream)
                      // ImageDefinition has properties like original, placeholderDataURL, originalSize
                      // We check by accessing properties directly (without using has() or 'in' operator) to avoid Proxy errors
                      // IMPORTANT: Wrap each property access in try-catch to prevent Proxy errors
                      let isImageDefinition = false;
                      try {
                        if (nestedValue.$isLoaded && !isFileStream) {
                          // Try to access ImageDefinition-specific properties directly
                          // Wrap each check in try-catch to avoid Proxy errors
                          let hasOriginal = false;
                          let hasPlaceholder = false;
                          let hasOriginalSize = false;

                          try {
                            hasOriginal = (nestedValue as any).original !== undefined;
                          } catch (e) {
                            // Ignore Proxy errors when checking for original
                          }

                          try {
                            hasPlaceholder = (nestedValue as any).placeholderDataURL !== undefined;
                          } catch (e) {
                            // Ignore Proxy errors when checking for placeholderDataURL
                          }

                          try {
                            hasOriginalSize = (nestedValue as any).originalSize !== undefined;
                          } catch (e) {
                            // Ignore Proxy errors when checking for originalSize
                          }

                          // ImageDefinition has at least original and originalSize
                          isImageDefinition = hasOriginal || hasOriginalSize;
                        }
                      } catch (e) {
                        console.warn(
                          `[Data Explorer] Error checking ImageDefinition for ${nestedKey}:`,
                          e,
                        );
                      }

                      if (isFileStream) {
                        // Safely extract ID and metadata for FileStream
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
                          console.warn(
                            `[Data Explorer] Error accessing FileStream metadata for ${nestedKey}:`,
                            e,
                          );
                        }

                        nestedProperties[nestedKey] = {
                          type: "FileStream",
                          id: fileStreamId,
                          isLoaded: nestedValue.$isLoaded || false,
                          mimeType,
                          size,
                          fileStream: nestedValue, // Store reference
                          coValue: nestedValue, // Store reference for navigation
                        };
                      } else if (isImageDefinition) {
                        // Safely extract ID without triggering Proxy errors
                        // Try multiple methods to get the ID
                        let imageId = "unknown";
                        try {
                          // Method 1: Try $jazz.id directly
                          imageId = nestedValue.$jazz?.id || "unknown";
                        } catch (e) {
                          // Method 2: Try accessing id property directly
                          try {
                            imageId = (nestedValue as any).id || "unknown";
                          } catch (e2) {
                            // Method 3: Try to get ID from the CoValue reference itself
                            try {
                              if (nestedValue.$jazz) {
                                imageId = nestedValue.$jazz.id || "unknown";
                              }
                            } catch (e3) {
                              console.warn(
                                `[Data Explorer] All ID extraction methods failed for ImageDefinition ${nestedKey}:`,
                                e3,
                              );
                            }
                          }
                        }

                        // If we still don't have a valid ID, try to extract it from the imageDefinition reference
                        if (imageId === "unknown" && nestedValue.$isLoaded) {
                          try {
                            // Store the nestedValue itself - PropertyValue can extract ID from it
                            nestedProperties[nestedKey] = {
                              type: "ImageDefinition",
                              id: imageId, // May be "unknown" but we'll try to use the reference
                              isLoaded: nestedValue.$isLoaded || false,
                              imageDefinition: nestedValue, // Store reference for Image component
                              coValue: nestedValue, // Store reference for navigation
                              // Store the raw value so PropertyValue can try to extract ID
                              rawValue: nestedValue,
                            };
                          } catch (e) {
                            console.warn(
                              `[Data Explorer] Error storing ImageDefinition ${nestedKey}:`,
                              e,
                            );
                            // Fallback: store as generic CoValue
                            nestedProperties[nestedKey] = {
                              type: "CoValue",
                              id: "unknown",
                              isLoaded: nestedValue.$isLoaded || false,
                              value: "ImageDefinition (ID extraction failed)",
                              coValue: nestedValue,
                            };
                          }
                        } else {
                          nestedProperties[nestedKey] = {
                            type: "ImageDefinition",
                            id: imageId,
                            isLoaded: nestedValue.$isLoaded || false,
                            imageDefinition: nestedValue, // Store reference for Image component
                            coValue: nestedValue, // Store reference for navigation
                          };
                        }
                      } else {
                        nestedProperties[nestedKey] = {
                          type: "CoValue",
                          id: nestedValue.$jazz?.id || "unknown",
                          isLoaded: nestedValue.$isLoaded || false,
                          value: nestedValue.$isLoaded ? String(nestedValue) : "Loading...",
                          coValue: nestedValue, // Store reference for navigation
                        };
                      }
                    } else {
                      nestedProperties[nestedKey] = nestedValue;
                    }
                  } catch (error) {
                    // Log error for debugging but skip inaccessible properties
                    console.warn(
                      `[Data Explorer] Error accessing nested property ${nestedKey}:`,
                      error,
                    );
                  }
                }
              } catch (e) {
                console.warn(`[Data Explorer] Error extracting nested properties from ${key}:`, e);
              }
            }

            // Extract Jazz metadata for nested CoMap (like avatar)
            const nestedCoMapMetadata = value.$isLoaded
              ? (() => {
                  try {
                    const metadata = extractCoValueProperties(value);
                    return metadata?.jazzMetadata || null;
                  } catch (error) {
                    console.warn(
                      `[Data Explorer] Error extracting metadata for nested CoMap ${key}:`,
                      error,
                    );
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
              coValue: value, // Store reference to the CoValue for operations
            };
          }
        } else if (value !== undefined && value !== null) {
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
        // Get group info (members and parent groups) if this is a CoValue with an owner group
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

  // Get root data - extract all available CoValues
  const rootData = $derived(() => {
    if (!me.$isLoaded || !me.root?.$isLoaded) {
      return null;
    }

    const root = me.root;
    const data: Record<string, any> = {};

    // Get all properties from root (which is a CoMap)
    let keys: string[] = [];
    try {
      // Try using Object.keys first (most reliable for CoMaps)
      keys = Object.keys(root).filter((key) => key !== "$jazz" && key !== "$isLoaded");

      // If that doesn't work or returns empty, try $jazz.keys() if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (keys.length === 0 && root.$jazz && typeof (root.$jazz as any).keys === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        keys = Array.from((root.$jazz as any).keys());
      }
    } catch (e) {
      console.warn("Error getting root keys:", e);
    }

    // Iterate over all keys and extract values
    for (const key of keys) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const value = (root as any)[key];

        // Skip internal Jazz properties
        if (key.startsWith("$") || key === "constructor") {
          continue;
        }

        // Handle different CoValue types
        if (value && typeof value === "object" && "$jazz" in value) {
          // Check if it's a CoList (has length and is iterable)
          if (
            Array.isArray(value) ||
            (value.length !== undefined && typeof value[Symbol.iterator] === "function")
          ) {
            // It's a CoList - extract all items
            const items: any[] = [];
            try {
              const listArray = Array.from(value);
              items.push(
                ...listArray.map((item, index) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const itemAny = item as any;
                  if (item && typeof item === "object" && "$jazz" in item) {
                    return {
                      index,
                      type: "CoValue",
                      id: itemAny.$jazz?.id || "unknown",
                      isLoaded: itemAny.$isLoaded || false,
                      // Try to get a string representation
                      preview: itemAny.$isLoaded
                        ? itemAny["@label"] || itemAny.$jazz?.id?.slice(0, 8) || "CoValue"
                        : "Loading...",
                      // Store the full item reference for detailed display
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
            };
          } else {
            // It's a CoMap or other CoValue - extract nested properties
            const nestedProperties: Record<string, any> = {};
            if (value.$isLoaded) {
              try {
                // Get keys from CoMap - prefer $jazz.keys() as it's more reliable for CoMaps
                let nestedKeys: string[] = [];
                if (value.$jazz && typeof value.$jazz.keys === "function") {
                  nestedKeys = Array.from(value.$jazz.keys());
                } else {
                  // Fallback to Object.keys() if $jazz.keys() not available
                  nestedKeys = Object.keys(value).filter(
                    (k) => !k.startsWith("$") && k !== "constructor",
                  );
                }

                // Special handling for avatar CoMap - try to access image property directly
                // Don't use has() as it causes Proxy errors for ImageDefinition
                if (key === "avatar") {
                  try {
                    // Try to access image directly - if it exists, add to keys
                    const imageValue = (value as any).image;
                    if (
                      imageValue !== undefined &&
                      imageValue !== null &&
                      !nestedKeys.includes("image")
                    ) {
                      nestedKeys.push("image");
                    }
                  } catch (e) {
                    // Ignore errors when accessing image property
                    console.warn(`[Data Explorer] Could not access image property for avatar:`, e);
                  }
                }

                // Extract nested properties
                for (const nestedKey of nestedKeys) {
                  try {
                    // Skip property existence check for now - just try to access it directly
                    // The has() check was causing Proxy errors for ImageDefinition properties
                    // Since we already have the keys from $jazz.keys() or Object.keys(), we know they exist

                    const nestedValue = value[nestedKey];

                    // If the value is undefined/null, skip it
                    if (nestedValue === undefined || nestedValue === null) {
                      continue;
                    }

                    // Handle nested CoValues recursively
                    // Check for $jazz property directly instead of using 'in' operator to avoid Proxy errors
                    if (nestedValue && typeof nestedValue === "object" && nestedValue.$jazz) {
                      // Check if the nested value (value) is an ImageDefinition
                      // This is the parent of nestedKey properties like original, 512x512, etc.
                      const parentIsImageDefinition = (() => {
                        try {
                          // Check if parent value (value) has ImageDefinition properties
                          const hasOriginalSize = (value as any).originalSize !== undefined;
                          const hasPlaceholder = (value as any).placeholderDataURL !== undefined;
                          const hasOriginal = (value as any).original !== undefined;
                          // ImageDefinition always has originalSize when loaded
                          return hasOriginalSize || (hasPlaceholder && hasOriginal);
                        } catch (e) {
                          return false;
                        }
                      })();

                      // Check if it's a FileStream (binary data) - check this FIRST before ImageDefinition
                      // FileStreams have methods like getChunks, toBlob, getMimeType, getSize, isBinaryStreamEnded
                      // IMPORTANT: Check even if not loaded, as FileStreams inside ImageDefinition might not be loaded yet
                      let isFileStream = false;
                      try {
                        // If parent is ImageDefinition, certain properties are ALWAYS FileStreams
                        if (parentIsImageDefinition) {
                          // Properties inside ImageDefinition that are FileStreams:
                          // - "original" (always a FileStream according to docs)
                          // - Numeric patterns like "512x512", "256x256" (progressive loading variants - also FileStreams)
                          if (nestedKey === "original" || /^\d+x\d+$/.test(nestedKey)) {
                            isFileStream = true;
                          }
                        }

                        // Also check for FileStream-specific methods (check even if not loaded - methods might be on prototype)
                        if (!isFileStream) {
                          const hasGetChunks = typeof (nestedValue as any).getChunks === "function";
                          const hasToBlob = typeof (nestedValue as any).toBlob === "function";
                          const hasGetMimeType =
                            typeof (nestedValue as any).getMimeType === "function";
                          const hasGetSize = typeof (nestedValue as any).getSize === "function";
                          const hasIsBinaryStreamEnded =
                            typeof (nestedValue as any).isBinaryStreamEnded === "function";

                          // FileStream has at least getChunks and toBlob
                          isFileStream = hasGetChunks || hasToBlob || hasIsBinaryStreamEnded;
                        }
                      } catch (e) {
                        console.warn(
                          `[Data Explorer] Error checking FileStream for ${nestedKey}:`,
                          e,
                        );
                      }

                      // Check if it's an ImageDefinition (only if not a FileStream)
                      // ImageDefinition has properties like original, placeholderDataURL, originalSize
                      // We check by accessing properties directly (without using has() or 'in' operator) to avoid Proxy errors
                      // IMPORTANT: Wrap each property access in try-catch to prevent Proxy errors
                      let isImageDefinition = false;
                      try {
                        if (nestedValue.$isLoaded && !isFileStream) {
                          // Try to access ImageDefinition-specific properties directly
                          // Wrap each check in try-catch to avoid Proxy errors
                          let hasOriginal = false;
                          let hasPlaceholder = false;
                          let hasOriginalSize = false;

                          try {
                            hasOriginal = (nestedValue as any).original !== undefined;
                          } catch (e) {
                            // Ignore Proxy errors when checking for original
                          }

                          try {
                            hasPlaceholder = (nestedValue as any).placeholderDataURL !== undefined;
                          } catch (e) {
                            // Ignore Proxy errors when checking for placeholderDataURL
                          }

                          try {
                            hasOriginalSize = (nestedValue as any).originalSize !== undefined;
                          } catch (e) {
                            // Ignore Proxy errors when checking for originalSize
                          }

                          // ImageDefinition has at least original and originalSize
                          isImageDefinition = hasOriginal || hasOriginalSize;
                        }
                      } catch (e) {
                        console.warn(
                          `[Data Explorer] Error checking ImageDefinition for ${nestedKey}:`,
                          e,
                        );
                      }

                      if (isFileStream) {
                        // Safely extract ID and metadata for FileStream
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
                          console.warn(
                            `[Data Explorer] Error accessing FileStream metadata for ${nestedKey}:`,
                            e,
                          );
                        }

                        nestedProperties[nestedKey] = {
                          type: "FileStream",
                          id: fileStreamId,
                          isLoaded: nestedValue.$isLoaded || false,
                          mimeType,
                          size,
                          fileStream: nestedValue, // Store reference
                          coValue: nestedValue, // Store reference for navigation
                        };
                      } else if (isImageDefinition) {
                        // Safely extract ID without triggering Proxy errors
                        // Try multiple methods to get the ID
                        let imageId = "unknown";
                        try {
                          // Method 1: Try $jazz.id directly
                          imageId = nestedValue.$jazz?.id || "unknown";
                        } catch (e) {
                          // Method 2: Try accessing id property directly
                          try {
                            imageId = (nestedValue as any).id || "unknown";
                          } catch (e2) {
                            // Method 3: Try to get ID from the CoValue reference itself
                            try {
                              if (nestedValue.$jazz) {
                                imageId = nestedValue.$jazz.id || "unknown";
                              }
                            } catch (e3) {
                              console.warn(
                                `[Data Explorer] All ID extraction methods failed for ImageDefinition ${nestedKey}:`,
                                e3,
                              );
                            }
                          }
                        }

                        // If we still don't have a valid ID, try to extract it from the imageDefinition reference
                        if (imageId === "unknown" && nestedValue.$isLoaded) {
                          try {
                            // Store the nestedValue itself - PropertyValue can extract ID from it
                            nestedProperties[nestedKey] = {
                              type: "ImageDefinition",
                              id: imageId, // May be "unknown" but we'll try to use the reference
                              isLoaded: nestedValue.$isLoaded || false,
                              imageDefinition: nestedValue, // Store reference for Image component
                              coValue: nestedValue, // Store reference for navigation
                              // Store the raw value so PropertyValue can try to extract ID
                              rawValue: nestedValue,
                            };
                          } catch (e) {
                            console.warn(
                              `[Data Explorer] Error storing ImageDefinition ${nestedKey}:`,
                              e,
                            );
                            // Fallback: store as generic CoValue
                            nestedProperties[nestedKey] = {
                              type: "CoValue",
                              id: "unknown",
                              isLoaded: nestedValue.$isLoaded || false,
                              value: "ImageDefinition (ID extraction failed)",
                              coValue: nestedValue,
                            };
                          }
                        } else {
                          nestedProperties[nestedKey] = {
                            type: "ImageDefinition",
                            id: imageId,
                            isLoaded: nestedValue.$isLoaded || false,
                            imageDefinition: nestedValue, // Store reference for Image component
                            coValue: nestedValue, // Store reference for navigation
                          };
                        }
                      } else {
                        nestedProperties[nestedKey] = {
                          type: "CoValue",
                          id: nestedValue.$jazz?.id || "unknown",
                          isLoaded: nestedValue.$isLoaded || false,
                          value: nestedValue.$isLoaded ? String(nestedValue) : "Loading...",
                          coValue: nestedValue, // Store reference for navigation
                        };
                      }
                    } else {
                      nestedProperties[nestedKey] = nestedValue;
                    }
                  } catch (error) {
                    // Log error for debugging but skip inaccessible properties
                    console.warn(
                      `[Data Explorer] Error accessing nested property ${nestedKey}:`,
                      error,
                    );
                  }
                }
              } catch (e) {
                console.warn(`[Data Explorer] Error extracting nested properties from ${key}:`, e);
              }
            }

            // Extract Jazz metadata for nested CoMap (like avatar)
            const nestedCoMapMetadata = value.$isLoaded
              ? (() => {
                  try {
                    const metadata = extractCoValueProperties(value);
                    return metadata?.jazzMetadata || null;
                  } catch (error) {
                    console.warn(
                      `[Data Explorer] Error extracting metadata for nested CoMap ${key}:`,
                      error,
                    );
                    return null;
                  }
                })()
              : null;

            data[key] = {
              type: "CoMap",
              id: value.$jazz?.id || "unknown",
              isLoaded: value.$isLoaded || false,
              // Try to get a string representation
              value: value.$isLoaded ? String(value) : "Loading...",
              // Extract properties if it's a CoMap
              properties: nestedProperties,
              jazzMetadata: nestedCoMapMetadata,
              coValue: value, // Store reference to the CoValue for operations
            };
          }
        } else if (value !== undefined && value !== null) {
          data[key] = value;
        }
      } catch (e) {
        data[key] = `[Error accessing: ${String(e)}]`;
      }
    }

    // Add Profile to the data if it exists
    if (me.profile && (me.profile as any).$isLoaded) {
      try {
        const profile = me.profile as any;
        const profileProperties: Record<string, any> = {};

        // Extract profile properties
        let profileKeys: string[] = [];
        if (profile.$jazz && typeof profile.$jazz.keys === "function") {
          profileKeys = Array.from(profile.$jazz.keys());
        } else {
          profileKeys = Object.keys(profile).filter(
            (key) => key !== "$jazz" && key !== "$isLoaded",
          );
        }

        for (const key of profileKeys) {
          if (key.startsWith("$") || key === "constructor") continue;
          try {
            const value = profile[key];
            if (value !== undefined && value !== null) {
              profileProperties[key] = value;
            }
          } catch (e) {
            // Ignore errors
          }
        }

        // Extract profile metadata
        const profileMetadata = extractCoValueProperties(profile);

        data["profile"] = {
          type: "CoMap",
          id: profile.$jazz?.id || "unknown",
          isLoaded: profile.$isLoaded || false,
          properties: profileProperties,
          jazzMetadata: profileMetadata?.jazzMetadata || null,
          coValue: profile, // Store reference for navigation
        };
      } catch (e) {
        console.warn("Error adding profile to rootData:", e);
      }
    }

    // Also include Jazz metadata
    return {
      properties: data,
      jazzMetadata: {
        id: root.$jazz?.id,
        owner: root.$jazz?.owner,
        // Get owner info if it's a Group
        ownerInfo:
          root.$jazz?.owner && typeof root.$jazz.owner === "object" && "$jazz" in root.$jazz.owner
            ? {
                type: "Group",
                id: root.$jazz.owner.$jazz?.id || "unknown",
              }
            : null,
        // Get all keys that exist
        keys: keys,
      },
    };
  });
</script>

<div class="w-full max-w-7xl mx-auto px-6 pt-24 pb-20">
  {#if isBetterAuthPending}
    <div class="text-center pt-8 pb-4">
      <p class="text-slate-500">Loading...</p>
    </div>
  {:else if !isBetterAuthSignedIn}
    <div class="text-center pt-8 pb-4">
      <h1 class="text-4xl font-bold text-slate-700 mb-4">Welcome</h1>
      <p class="text-slate-500 mb-6">Please sign in to access your data.</p>
    </div>
  {:else if !me.$isLoaded}
    <div class="text-center pt-8 pb-4">
      <p class="text-slate-500">Loading your account...</p>
    </div>
  {:else if me.$isLoaded}
    {@const leftTitle = currentContext.type === "root" ? "My Data" : currentContext.label}

    <DataLayout
      {leftTitle}
      leftIconType={currentContext.type}
      rightTitle={currentContext.type !== "group" ? "Metadata" : undefined}
      showRightIcon={currentContext.type !== "group"}
      showBack={navigationStack.length > 1}
      onBack={navigateBack}
    >
      {#snippet main()}
        {#if currentContext.type === "root"}
          {#if rootData()}
            <RootDataDisplay
              rootData={rootData()}
              rootCoValue={me.root}
              extractCoValueProperties={extractCoValuePropertiesInline}
              onSelect={(coValue: any) => {
                navigateToCoValue(coValue);
              }}
              onCoListClick={(coList: any, label: string, parentKey?: string) => {
                navigateToCoList(coList, label, parentKey);
              }}
            />
          {:else if me.$isLoaded && me.root && !me.root.$isLoaded}
            <div class="text-center py-8">
              <p class="text-sm text-slate-500">Loading root...</p>
            </div>
          {:else}
            <div class="text-center py-8">
              <p class="text-sm text-slate-500">Root not available</p>
            </div>
          {/if}
        {:else if currentContext.type === "group"}
          <GroupContextView group={currentContext.coValue} onNavigate={navigateToCoValue} />
        {:else if currentContext.type === "colist" || currentContext.type === "covalue"}
          <CoValueContextDisplay
            coValue={currentContext.coValue}
            onNavigate={navigateToCoValue}
            onObjectNavigate={navigateToObject}
          />
        {:else if currentContext.type === "object"}
          <ObjectContextDisplay object={currentContext.object} label={currentContext.label} />
        {/if}
      {/snippet}
      {#snippet aside()}
        {#if currentContext.type !== "group"}
          <MetadataSidebar selectedCoValue={selectedCoValue()} currentAccount={me} />
        {/if}
      {/snippet}
    </DataLayout>
  {/if}
</div>
