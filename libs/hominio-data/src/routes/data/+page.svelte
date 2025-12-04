<script lang="ts">
  import { JazzAccount } from "$lib/schema";
  import { AccountCoState, Image } from "jazz-tools/svelte";
  import { authClient } from "$lib/auth-client";

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
        o: {
          humans: true, // Resolve humans list
          coops: true, // Resolve coops list
        },
      },
    },
  });
  const me = $derived(account.current);

  // Track expanded/selected CoValue instances
  // Use an array instead of Set for better reactivity in Svelte 5
  let expandedCoValues = $state<string[]>([]);
  let selectedCoValue: any = $state(null);

  // Helper function to check if a CoValue is expanded
  function isCoValueExpanded(coValueId: string): boolean {
    return expandedCoValues.includes(coValueId);
  }

  // Function to extract all properties from a CoValue instance
  function extractCoValueProperties(coValue: any): {
    properties: Record<string, any>;
    jazzMetadata: {
      id: string;
      owner: any;
      ownerInfo: any;
      keys: string[];
    };
  } | null {
    if (!coValue || !coValue.$jazz) {
      return null;
    }

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
                  if (item && typeof item === "object" && "$jazz" in item) {
                    return {
                      index,
                      type: "CoValue",
                      id: item.$jazz?.id || "unknown",
                      isLoaded: item.$isLoaded || false,
                      preview: item.$isLoaded
                        ? item["@label"] || item.$jazz?.id?.slice(0, 8) || "CoValue"
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
            // CoMap or other CoValue - extract nested properties
            const nestedProperties: Record<string, any> = {};
            if (value.$isLoaded) {
              try {
                // Get keys from CoMap - prefer $jazz.keys() as it's more reliable for CoMaps
                let nestedKeys: string[] = [];
                if (value.$jazz && typeof value.$jazz.keys === "function") {
                  nestedKeys = Array.from(value.$jazz.keys());
                  console.log(
                    `[Data Explorer] Extracted keys from ${key} using $jazz.keys():`,
                    nestedKeys,
                  );
                } else {
                  // Fallback to Object.keys() if $jazz.keys() not available
                  nestedKeys = Object.keys(value).filter(
                    (k) => !k.startsWith("$") && k !== "constructor",
                  );
                  console.log(
                    `[Data Explorer] Extracted keys from ${key} using Object.keys():`,
                    nestedKeys,
                  );
                }

                // Special handling for avatar CoMap - ensure image property is checked even if optional
                if (
                  key === "avatar" &&
                  value.$jazz &&
                  typeof (value.$jazz as any).has === "function"
                ) {
                  // Check if image property exists (even if not in keys list yet)
                  if ((value.$jazz as any).has("image")) {
                    if (!nestedKeys.includes("image")) {
                      console.log(
                        `[Data Explorer] Adding 'image' to keys for avatar (exists but not in keys list)`,
                      );
                      nestedKeys.push("image");
                    }
                  }
                }

                // Extract nested properties
                for (const nestedKey of nestedKeys) {
                  try {
                    // Skip property existence check for now - just try to access it directly
                    // The has() check was causing Proxy errors for ImageDefinition properties
                    // Since we already have the keys from $jazz.keys() or Object.keys(), we know they exist

                    console.log(`[Data Explorer] Accessing property ${nestedKey} from ${key}`);
                    const nestedValue = value[nestedKey];
                    console.log(`[Data Explorer] Property ${nestedKey} value:`, nestedValue);

                    // If the value is undefined/null, skip it
                    if (nestedValue === undefined || nestedValue === null) {
                      console.log(
                        `[Data Explorer] Property ${nestedKey} is undefined/null, skipping`,
                      );
                      continue;
                    }

                    // Handle nested CoValues recursively
                    // Check for $jazz property directly instead of using 'in' operator to avoid Proxy errors
                    if (nestedValue && typeof nestedValue === "object" && nestedValue.$jazz) {
                      console.log(
                        `[Data Explorer] Property ${nestedKey} is a CoValue, ID:`,
                        nestedValue.$jazz?.id,
                      );
                      
                      // Check if it's an ImageDefinition
                      // ImageDefinition has properties like original, placeholderDataURL, originalSize
                      // We check by accessing properties directly (without using has() or 'in' operator) to avoid Proxy errors
                      let isImageDefinition = false;
                      try {
                        if (nestedValue.$isLoaded) {
                          // Try to access ImageDefinition-specific properties directly
                          // ImageDefinition always has these properties when loaded
                          const hasOriginal = (nestedValue as any).original !== undefined;
                          const hasPlaceholder = (nestedValue as any).placeholderDataURL !== undefined;
                          const hasOriginalSize = (nestedValue as any).originalSize !== undefined;
                          
                          // ImageDefinition has at least original and originalSize
                          isImageDefinition = hasOriginal || hasOriginalSize;
                          
                          console.log(
                            `[Data Explorer] Property ${nestedKey} isImageDefinition:`,
                            isImageDefinition,
                            `(hasOriginal: ${hasOriginal}, hasPlaceholder: ${hasPlaceholder}, hasOriginalSize: ${hasOriginalSize})`,
                          );
                        }
                      } catch (e) {
                        console.warn(
                          `[Data Explorer] Error checking ImageDefinition for ${nestedKey}:`,
                          e,
                        );
                      }
                      
                      if (isImageDefinition) {
                        nestedProperties[nestedKey] = {
                          type: "ImageDefinition",
                          id: nestedValue.$jazz?.id || "unknown",
                          isLoaded: nestedValue.$isLoaded || false,
                          imageDefinition: nestedValue, // Store reference for Image component
                        };
                      } else {
                        nestedProperties[nestedKey] = {
                          type: "CoValue",
                          id: nestedValue.$jazz?.id || "unknown",
                          isLoaded: nestedValue.$isLoaded || false,
                          value: nestedValue.$isLoaded ? String(nestedValue) : "Loading...",
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

                console.log(
                  `[Data Explorer] Final nested properties for ${key}:`,
                  Object.keys(nestedProperties),
                );
              } catch (e) {
                console.warn(`[Data Explorer] Error extracting nested properties from ${key}:`, e);
              }
            }

            data[key] = {
              type: "CoMap",
              id: value.$jazz?.id || "unknown",
              isLoaded: value.$isLoaded || false,
              properties: nestedProperties,
              value: value.$isLoaded ? String(value) : "Loading...",
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
      },
    };
  }

  // Function to handle CoValue click
  function handleCoValueClick(coValue: any, coValueId: string, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    console.log("CoValue clicked:", coValueId, "Current expanded:", expandedCoValues);

    // Check if already expanded
    const index = expandedCoValues.indexOf(coValueId);

    if (index > -1) {
      // Collapse - remove from array
      expandedCoValues = expandedCoValues.filter((id) => id !== coValueId);
      if (selectedCoValue?.$jazz?.id === coValueId) {
        selectedCoValue = null;
      }
      console.log("Collapsing:", coValueId);
    } else {
      // Expand - add to array
      expandedCoValues = [...expandedCoValues, coValueId];
      selectedCoValue = coValue;
      console.log("Expanding:", coValueId);
    }

    console.log("New expanded array:", expandedCoValues);
  }

  // Get profile data - extract all available properties
  const profileData = $derived(() => {
    if (!me.$isLoaded || !me.profile?.$isLoaded) {
      return null;
    }

    const profile = me.profile;
    const data: Record<string, any> = {};

    // Get all properties from the profile object
    // Profile is a CoMap, which behaves like a regular object
    // Try to get keys using Object.keys() (CoMaps are enumerable)
    let keys: string[] = [];
    try {
      // Try using Object.keys first (most reliable for CoMaps)
      keys = Object.keys(profile).filter((key) => key !== "$jazz" && key !== "$isLoaded");

      // If that doesn't work or returns empty, try $jazz.keys() if available
      if (keys.length === 0 && profile.$jazz && typeof profile.$jazz.keys === "function") {
        keys = Array.from(profile.$jazz.keys());
      }
    } catch (e) {
      console.warn("Error getting profile keys:", e);
    }

    // Iterate over all keys and extract values
    for (const key of keys) {
      try {
        const value = profile[key];

        // Skip internal Jazz properties
        if (key.startsWith("$") || key === "constructor") {
          continue;
        }

        // Handle different value types
        if (value && typeof value === "object" && "$jazz" in value) {
          // It's a CoValue - store its ID and type info
          data[key] = {
            type: "CoValue",
            id: value.$jazz?.id || "unknown",
            isLoaded: value.$isLoaded || false,
            // If it's loaded, try to get string representation
            value: value.$isLoaded ? String(value) : "Loading...",
          };
        } else if (value !== undefined && value !== null) {
          data[key] = value;
        }
      } catch (e) {
        data[key] = `[Error accessing: ${String(e)}]`;
      }
    }

    // Also include Jazz metadata
    return {
      properties: data,
      jazzMetadata: {
        id: profile.$jazz?.id,
        owner: profile.$jazz?.owner,
        // Get owner info if it's a Group
        ownerInfo:
          profile.$jazz?.owner &&
          typeof profile.$jazz.owner === "object" &&
          "$jazz" in profile.$jazz.owner
            ? {
                type: "Group",
                id: profile.$jazz.owner.$jazz?.id || "unknown",
              }
            : null,
        // Get all keys that exist
        keys: keys,
      },
    };
  });

  // Get root.o data - extract all available CoValues
  const rootOData = $derived(() => {
    if (!me.$isLoaded || !me.root?.o?.$isLoaded) {
      return null;
    }

    const rootO = me.root.o;
    const data: Record<string, any> = {};

    // Get all properties from root.o (which is a CoMap)
    let keys: string[] = [];
    try {
      // Try using Object.keys first (most reliable for CoMaps)
      keys = Object.keys(rootO).filter((key) => key !== "$jazz" && key !== "$isLoaded");

      // If that doesn't work or returns empty, try $jazz.keys() if available
      if (keys.length === 0 && rootO.$jazz && typeof rootO.$jazz.keys === "function") {
        keys = Array.from(rootO.$jazz.keys());
      }
    } catch (e) {
      console.warn("Error getting root.o keys:", e);
    }

    // Iterate over all keys and extract values
    for (const key of keys) {
      try {
        const value = rootO[key];

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
                  if (item && typeof item === "object" && "$jazz" in item) {
                    return {
                      index,
                      type: "CoValue",
                      id: item.$jazz?.id || "unknown",
                      isLoaded: item.$isLoaded || false,
                      // Try to get a string representation
                      preview: item.$isLoaded
                        ? item["@label"] || item.$jazz?.id?.slice(0, 8) || "CoValue"
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
                  console.log(
                    `[Data Explorer] Extracted keys from ${key} using $jazz.keys():`,
                    nestedKeys,
                  );
                } else {
                  // Fallback to Object.keys() if $jazz.keys() not available
                  nestedKeys = Object.keys(value).filter(
                    (k) => !k.startsWith("$") && k !== "constructor",
                  );
                  console.log(
                    `[Data Explorer] Extracted keys from ${key} using Object.keys():`,
                    nestedKeys,
                  );
                }

                // Special handling for avatar CoMap - ensure image property is checked even if optional
                if (
                  key === "avatar" &&
                  value.$jazz &&
                  typeof (value.$jazz as any).has === "function"
                ) {
                  // Check if image property exists (even if not in keys list yet)
                  if ((value.$jazz as any).has("image")) {
                    if (!nestedKeys.includes("image")) {
                      console.log(
                        `[Data Explorer] Adding 'image' to keys for avatar (exists but not in keys list)`,
                      );
                      nestedKeys.push("image");
                    }
                  }
                }

                // Extract nested properties
                for (const nestedKey of nestedKeys) {
                  try {
                    // Skip property existence check for now - just try to access it directly
                    // The has() check was causing Proxy errors for ImageDefinition properties
                    // Since we already have the keys from $jazz.keys() or Object.keys(), we know they exist

                    console.log(`[Data Explorer] Accessing property ${nestedKey} from ${key}`);
                    const nestedValue = value[nestedKey];
                    console.log(`[Data Explorer] Property ${nestedKey} value:`, nestedValue);

                    // If the value is undefined/null, skip it
                    if (nestedValue === undefined || nestedValue === null) {
                      console.log(
                        `[Data Explorer] Property ${nestedKey} is undefined/null, skipping`,
                      );
                      continue;
                    }

                    // Handle nested CoValues recursively
                    // Check for $jazz property directly instead of using 'in' operator to avoid Proxy errors
                    if (nestedValue && typeof nestedValue === "object" && nestedValue.$jazz) {
                      console.log(
                        `[Data Explorer] Property ${nestedKey} is a CoValue, ID:`,
                        nestedValue.$jazz?.id,
                      );
                      
                      // Check if it's an ImageDefinition
                      // ImageDefinition has properties like original, placeholderDataURL, originalSize
                      // We check by accessing properties directly (without using has() or 'in' operator) to avoid Proxy errors
                      let isImageDefinition = false;
                      try {
                        if (nestedValue.$isLoaded) {
                          // Try to access ImageDefinition-specific properties directly
                          // ImageDefinition always has these properties when loaded
                          const hasOriginal = (nestedValue as any).original !== undefined;
                          const hasPlaceholder = (nestedValue as any).placeholderDataURL !== undefined;
                          const hasOriginalSize = (nestedValue as any).originalSize !== undefined;
                          
                          // ImageDefinition has at least original and originalSize
                          isImageDefinition = hasOriginal || hasOriginalSize;
                          
                          console.log(
                            `[Data Explorer] Property ${nestedKey} isImageDefinition:`,
                            isImageDefinition,
                            `(hasOriginal: ${hasOriginal}, hasPlaceholder: ${hasPlaceholder}, hasOriginalSize: ${hasOriginalSize})`,
                          );
                        }
                      } catch (e) {
                        console.warn(
                          `[Data Explorer] Error checking ImageDefinition for ${nestedKey}:`,
                          e,
                        );
                      }
                      
                      if (isImageDefinition) {
                        nestedProperties[nestedKey] = {
                          type: "ImageDefinition",
                          id: nestedValue.$jazz?.id || "unknown",
                          isLoaded: nestedValue.$isLoaded || false,
                          imageDefinition: nestedValue, // Store reference for Image component
                        };
                      } else {
                        nestedProperties[nestedKey] = {
                          type: "CoValue",
                          id: nestedValue.$jazz?.id || "unknown",
                          isLoaded: nestedValue.$isLoaded || false,
                          value: nestedValue.$isLoaded ? String(nestedValue) : "Loading...",
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

                console.log(
                  `[Data Explorer] Final nested properties for ${key}:`,
                  Object.keys(nestedProperties),
                );
              } catch (e) {
                console.warn(`[Data Explorer] Error extracting nested properties from ${key}:`, e);
              }
            }

            data[key] = {
              type: "CoMap",
              id: value.$jazz?.id || "unknown",
              isLoaded: value.$isLoaded || false,
              // Try to get a string representation
              value: value.$isLoaded ? String(value) : "Loading...",
              // Extract properties if it's a CoMap
              properties: nestedProperties,
            };
          }
        } else if (value !== undefined && value !== null) {
          data[key] = value;
        }
      } catch (e) {
        data[key] = `[Error accessing: ${String(e)}]`;
      }
    }

    // Also include Jazz metadata
    return {
      properties: data,
      jazzMetadata: {
        id: rootO.$jazz?.id,
        owner: rootO.$jazz?.owner,
        // Get owner info if it's a Group
        ownerInfo:
          rootO.$jazz?.owner &&
          typeof rootO.$jazz.owner === "object" &&
          "$jazz" in rootO.$jazz.owner
            ? {
                type: "Group",
                id: rootO.$jazz.owner.$jazz?.id || "unknown",
              }
            : null,
        // Get all keys that exist
        keys: keys,
      },
    };
  });
</script>

<div class="w-full space-y-6 pb-20">
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
    <!-- Header -->
    <header class="text-center pt-8 pb-4">
      <h1
        class="text-4xl font-bold bg-clip-text text-transparent bg-linear-to-br from-slate-700 to-slate-800 tracking-tight"
      >
        Data Explorer
      </h1>
      <p class="mt-2 text-sm text-slate-500">Explore your Jazz account profile and root data</p>
    </header>

    <!-- Profile Section -->
    <section>
      <div class="flex items-center justify-between mb-4 px-2">
        <h2 class="text-lg font-semibold text-slate-700 flex items-center gap-2">
          <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Profile Data
        </h2>
      </div>

      {#if profileData()}
        <div
          class="rounded-3xl border border-white bg-slate-50/40 backdrop-blur-sm shadow-[0_0_6px_rgba(0,0,0,0.03)] p-6"
        >
          <!-- Profile Properties -->
          <div class="mb-6">
            <h3 class="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wider">
              Properties
            </h3>
            {#if Object.keys(profileData().properties).length > 0}
              <div class="space-y-3">
                {#each Object.entries(profileData().properties) as [key, value]}
                  <div class="border-b border-slate-200/50 pb-3 last:border-b-0 last:pb-0">
                    <div class="flex items-start gap-3">
                      <span
                        class="text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[120px] shrink-0"
                      >
                        {key}:
                      </span>
                      <div class="flex-1 min-w-0">
                        {#if typeof value === "object" && value !== null && "type" in value}
                          <!-- CoValue type -->
                          <div class="space-y-1">
                            <div class="text-sm text-slate-700">
                              <span class="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded"
                                >{value.type}</span
                              >
                              {#if value.id}
                                <span class="ml-2 font-mono text-xs text-slate-500"
                                  >ID: {value.id.slice(0, 8)}...</span
                                >
                              {/if}
                            </div>
                            {#if value.value !== undefined}
                              <div class="text-sm text-slate-600 italic break-all break-words">
                                {value.value}
                              </div>
                            {/if}
                            {#if value.isLoaded !== undefined}
                              <div class="text-xs text-slate-400">
                                {value.isLoaded ? "✓ Loaded" : "⏳ Loading..."}
                              </div>
                            {/if}
                          </div>
                        {:else if typeof value === "string"}
                          <span class="text-sm text-slate-700 break-all break-words"
                            >{value || "(empty)"}</span
                          >
                        {:else if typeof value === "number" || typeof value === "boolean"}
                          <span class="text-sm font-mono text-slate-700">{String(value)}</span>
                        {:else if value === null}
                          <span class="text-sm text-slate-400 italic">null</span>
                        {:else if value === undefined}
                          <span class="text-sm text-slate-400 italic">undefined</span>
                        {:else}
                          <pre
                            class="text-xs text-slate-600 bg-slate-100/50 p-2 rounded overflow-x-auto">{JSON.stringify(
                              value,
                              null,
                              2,
                            )}</pre>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-sm text-slate-500 italic">No properties found</p>
            {/if}
          </div>

          <!-- Jazz Metadata -->
          <div>
            <h3 class="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wider">
              Jazz Metadata
            </h3>
            <div class="space-y-3">
              <div class="border-b border-slate-200/50 pb-3">
                <div class="flex items-start gap-3">
                  <span
                    class="text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[120px] shrink-0"
                  >
                    Profile ID:
                  </span>
                  <span
                    class="text-sm font-mono text-slate-700 break-all break-words flex-1 min-w-0"
                    >{profileData().jazzMetadata.id || "N/A"}</span
                  >
                </div>
              </div>
              <div class="border-b border-slate-200/50 pb-3">
                <div class="flex items-start gap-3">
                  <span
                    class="text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[120px]"
                  >
                    Owner:
                  </span>
                  <div class="flex-1">
                    {#if profileData().jazzMetadata.ownerInfo}
                      <div class="space-y-1">
                        <span class="text-sm text-slate-700">
                          {profileData().jazzMetadata.ownerInfo.type}
                        </span>
                        <div class="text-xs font-mono text-slate-500">
                          ID: {profileData().jazzMetadata.ownerInfo.id.slice(0, 8)}...
                        </div>
                      </div>
                    {:else if profileData().jazzMetadata.owner}
                      <span class="text-sm text-slate-700">
                        {String(profileData().jazzMetadata.owner)}
                      </span>
                    {:else}
                      <span class="text-sm text-slate-400 italic">N/A</span>
                    {/if}
                  </div>
                </div>
              </div>
              <div class="border-b border-slate-200/50 pb-3">
                <div class="flex items-start gap-3">
                  <span
                    class="text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[120px]"
                  >
                    Keys:
                  </span>
                  <div class="flex-1">
                    {#if profileData().jazzMetadata.keys.length > 0}
                      <div class="flex flex-wrap gap-2">
                        {#each profileData().jazzMetadata.keys as key}
                          <span
                            class="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-700"
                            >{key}</span
                          >
                        {/each}
                      </div>
                    {:else}
                      <span class="text-sm text-slate-400 italic">No keys</span>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      {:else if me.$isLoaded && me.profile && !me.profile.$isLoaded}
        <div
          class="p-8 rounded-3xl border border-dashed border-white bg-slate-50/40 text-center backdrop-blur-sm shadow-[0_0_6px_rgba(0,0,0,0.03)]"
        >
          <p class="text-sm text-slate-500">Loading profile...</p>
        </div>
      {:else}
        <div
          class="p-8 rounded-3xl border border-dashed border-white bg-slate-50/40 text-center backdrop-blur-sm shadow-[0_0_6px_rgba(0,0,0,0.03)]"
        >
          <p class="text-sm text-slate-500">Profile not available</p>
        </div>
      {/if}
    </section>

    <!-- BetterAuth User Profile Properties -->
    {#if betterAuthUser}
      <section>
        <div class="flex items-center justify-between mb-4 px-2">
          <h2 class="text-lg font-semibold text-slate-700 flex items-center gap-2">
            <svg
              class="w-5 h-5 text-slate-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Google Profile Data
          </h2>
        </div>
        <div
          class="rounded-3xl border border-white bg-slate-50/40 backdrop-blur-sm shadow-[0_0_6px_rgba(0,0,0,0.03)] p-6"
        >
          <div class="grid gap-3">
            {#each Object.entries(betterAuthUser) as [key, value]}
              {#if value !== null && value !== undefined}
                <div
                  class="flex items-start gap-3 py-2 border-b border-slate-200/50 last:border-b-0"
                >
                  <span
                    class="text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[120px] shrink-0"
                  >
                    {key}:
                  </span>
                  <div class="flex-1 min-w-0">
                    {#if typeof value === "object" && value !== null && !Array.isArray(value)}
                      <pre
                        class="text-xs font-mono text-slate-700 bg-slate-200/50 p-2 rounded overflow-x-auto break-all break-words">{JSON.stringify(
                          value,
                          null,
                          2,
                        )}</pre>
                    {:else if Array.isArray(value)}
                      <pre
                        class="text-xs font-mono text-slate-700 bg-slate-200/50 p-2 rounded overflow-x-auto break-all break-words">{JSON.stringify(
                          value,
                          null,
                          2,
                        )}</pre>
                    {:else}
                      <span class="text-sm text-slate-700 break-all break-words"
                        >{String(value)}</span
                      >
                    {/if}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      </section>
    {/if}

    <!-- Root.O CoValues Section -->
    <section>
      <div class="flex items-center justify-between mb-4 px-2">
        <h2 class="text-lg font-semibold text-slate-700 flex items-center gap-2">
          <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          Root.O CoValues
        </h2>
      </div>

      {#if rootOData()}
        <div
          class="rounded-3xl border border-white bg-slate-50/40 backdrop-blur-sm shadow-[0_0_6px_rgba(0,0,0,0.03)] p-6"
        >
          <!-- Root.O Properties -->
          <div class="mb-6">
            <h3 class="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wider">
              CoValues
            </h3>
            {#if Object.keys(rootOData().properties).length > 0}
              <div class="space-y-4">
                {#each Object.entries(rootOData().properties) as [key, value]}
                  <div class="border border-slate-200/50 rounded-lg p-4 bg-slate-200/50">
                    <div class="flex items-start gap-3 mb-3">
                      <span
                        class="text-sm font-semibold text-slate-700 uppercase tracking-wider min-w-[120px] shrink-0"
                      >
                        {key}:
                      </span>
                      <div class="flex-1 min-w-0">
                        {#if typeof value === "object" && value !== null && "type" in value}
                          {#if value.type === "CoList"}
                            <!-- CoList display -->
                            <div class="space-y-2">
                              <div class="flex items-center gap-2">
                                <span
                                  class="font-mono text-xs bg-blue-100 px-2 py-0.5 rounded text-blue-700"
                                >
                                  CoList
                                </span>
                                <span class="text-xs text-slate-500">
                                  ({value.length}
                                  {value.length === 1 ? "item" : "items"})
                                </span>
                                {#if value.id}
                                  <span class="ml-2 font-mono text-xs text-slate-400">
                                    ID: {value.id.slice(0, 8)}...
                                  </span>
                                {/if}
                                {#if value.isLoaded !== undefined}
                                  <span class="text-xs text-slate-400">
                                    {value.isLoaded ? "✓ Loaded" : "⏳ Loading..."}
                                  </span>
                                {/if}
                              </div>
                              {#if value.items && value.items.length > 0}
                                <div class="ml-4 space-y-2 border-l-2 border-slate-200 pl-3">
                                  {#each value.items as item}
                                    {#if item.type === "CoValue" && item.item}
                                      {@const coValueId = item.id}
                                      {@const isExpanded = isCoValueExpanded(coValueId)}
                                      {@const coValueProps = item.item.$isLoaded
                                        ? extractCoValueProperties(item.item)
                                        : null}
                                      <div class="text-sm">
                                        <button
                                          type="button"
                                          class="w-full text-left flex items-center gap-2 p-2 rounded cursor-pointer min-w-0"
                                          onclick={(e) =>
                                            handleCoValueClick(item.item, coValueId, e)}
                                        >
                                          <span
                                            class="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600"
                                          >
                                            [{item.index}]
                                          </span>
                                          <span
                                            class="text-slate-700 flex-1 break-all break-words min-w-0"
                                            >{item.preview}</span
                                          >
                                          <span
                                            class="font-mono text-xs text-slate-400 break-all break-words shrink-0"
                                          >
                                            ({item.id.slice(0, 8)}...)
                                          </span>
                                          {#if item.isLoaded !== undefined}
                                            <span class="text-xs text-slate-400 shrink-0">
                                              {item.isLoaded ? "✓" : "⏳"}
                                            </span>
                                          {/if}
                                          <svg
                                            class="w-4 h-4 text-slate-400 transition-transform {isExpanded
                                              ? 'rotate-90'
                                              : ''}"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              stroke-linecap="round"
                                              stroke-linejoin="round"
                                              stroke-width="2"
                                              d="M9 5l7 7-7 7"
                                            />
                                          </svg>
                                        </button>
                                        {#if isExpanded && coValueProps}
                                          <div
                                            class="ml-6 mt-2 p-4 bg-slate-200/50 rounded-lg border border-slate-200 space-y-4"
                                          >
                                            <!-- Properties -->
                                            {#if Object.keys(coValueProps.properties).length > 0}
                                              <div>
                                                <h4
                                                  class="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider"
                                                >
                                                  Properties
                                                </h4>
                                                <div class="space-y-2">
                                                  {#each Object.entries(coValueProps.properties) as [propKey, propValue]}
                                                    <div
                                                      class="text-xs border-b border-slate-100 pb-1"
                                                    >
                                                      <div class="flex items-start gap-2">
                                                        <span
                                                          class="font-semibold text-slate-600 min-w-[100px]"
                                                          >{propKey}:</span
                                                        >
                                                        <div class="flex-1">
                                                          {#if typeof propValue === "object" && propValue !== null && "type" in propValue}
                                                            {#if propValue.type === "CoList"}
                                                              <span
                                                                class="text-xs bg-blue-100 px-1.5 py-0.5 rounded text-blue-700"
                                                                >CoList</span
                                                              >
                                                              <span class="ml-2 text-slate-500"
                                                                >({propValue.length} items)</span
                                                              >
                                                            {:else if propValue.type === "CoMap"}
                                                              <div class="space-y-1 mt-1">
                                                                <span
                                                                  class="text-xs bg-purple-100 px-1.5 py-0.5 rounded text-purple-700"
                                                                  >CoMap</span
                                                                >
                                                                {#if propValue.properties && Object.keys(propValue.properties).length > 0}
                                                                  <div
                                                                    class="ml-3 mt-1 space-y-1 border-l-2 border-purple-200 pl-2"
                                                                  >
                                                                    {#each Object.entries(propValue.properties) as [nestedKey, nestedValue]}
                                                                      <div class="text-xs">
                                                                        <div
                                                                          class="flex items-center gap-2"
                                                                        >
                                                                          <span
                                                                            class="font-semibold text-slate-600"
                                                                            >{nestedKey}:</span
                                                                          >
                                                                          <div
                                                                            class="flex-1 flex items-center gap-2"
                                                                          >
                                                                            {#if typeof nestedValue === "object" && nestedValue !== null && "type" in nestedValue}
                                                                              {#if nestedValue.type === "ImageDefinition"}
                                                                                {#if nestedValue.isLoaded && nestedValue.imageDefinition}
                                                                                  <div
                                                                                    class="flex items-center gap-2"
                                                                                  >
                                                                                    <div
                                                                                      class="w-6 h-6 rounded overflow-hidden border border-slate-300 flex-shrink-0"
                                                                                    >
                                                                                      <Image
                                                                                        imageId={nestedValue
                                                                                          .imageDefinition
                                                                                          .$jazz.id}
                                                                                        width={24}
                                                                                        height={24}
                                                                                        alt={nestedKey}
                                                                                        class="object-cover w-full h-full"
                                                                                        loading="lazy"
                                                                                      />
                                                                                    </div>
                                                                                    <span
                                                                                      class="text-xs bg-green-100 px-1.5 py-0.5 rounded text-green-700"
                                                                                      >ImageDefinition</span
                                                                                    >
                                                                                    <span
                                                                                      class="ml-1 font-mono text-xs text-slate-400"
                                                                                      >({nestedValue.id?.slice(
                                                                                        0,
                                                                                        8,
                                                                                      )}...)</span
                                                                                    >
                                                                                  </div>
                                                                                {:else}
                                                                                  <span
                                                                                    class="text-xs bg-green-100 px-1.5 py-0.5 rounded text-green-700"
                                                                                    >ImageDefinition</span
                                                                                  >
                                                                                  <span
                                                                                    class="ml-1 text-xs text-slate-400"
                                                                                    >(Loading...)</span
                                                                                  >
                                                                                {/if}
                                                                              {:else if nestedValue.type === "CoValue"}
                                                                                <span
                                                                                  class="text-xs bg-purple-50 px-1 py-0.5 rounded text-purple-600"
                                                                                  >CoValue</span
                                                                                >
                                                                                <span
                                                                                  class="ml-1 font-mono text-xs text-slate-400"
                                                                                  >({nestedValue.id?.slice(
                                                                                    0,
                                                                                    8,
                                                                                  )}...)</span
                                                                                >
                                                                              {:else}
                                                                                <span
                                                                                  class="text-slate-700 break-all break-words"
                                                                                  >{JSON.stringify(
                                                                                    nestedValue,
                                                                                  )}</span
                                                                                >
                                                                              {/if}
                                                                            {:else if typeof nestedValue === "string"}
                                                                              <span
                                                                                class="text-slate-700 break-all break-words"
                                                                                >{nestedValue ||
                                                                                  "(empty)"}</span
                                                                              >
                                                                            {:else}
                                                                              <span
                                                                                class="text-slate-700 break-all break-words"
                                                                                >{String(
                                                                                  nestedValue,
                                                                                )}</span
                                                                              >
                                                                            {/if}
                                                                          </div>
                                                                        </div>
                                                                      </div>
                                                                    {/each}
                                                                  </div>
                                                                {:else}
                                                                  <span
                                                                    class="ml-2 text-xs text-slate-400 italic"
                                                                    >(empty)</span
                                                                  >
                                                                {/if}
                                                              </div>
                                                            {:else if propValue.type === "CoValue"}
                                                              <span
                                                                class="text-xs bg-purple-100 px-1.5 py-0.5 rounded text-purple-700"
                                                                >CoValue</span
                                                              >
                                                              <span
                                                                class="ml-2 font-mono text-xs text-slate-400"
                                                                >({propValue.id.slice(
                                                                  0,
                                                                  8,
                                                                )}...)</span
                                                              >
                                                            {/if}
                                                          {:else if typeof propValue === "string"}
                                                            <span
                                                              class="text-slate-700 break-all break-words"
                                                              >{propValue}</span
                                                            >
                                                          {:else if typeof propValue === "number" || typeof propValue === "boolean"}
                                                            <span
                                                              class="font-mono text-slate-700 break-all break-words"
                                                              >{String(propValue)}</span
                                                            >
                                                          {:else}
                                                            <span
                                                              class="text-slate-500 break-all break-words"
                                                              >{JSON.stringify(propValue)}</span
                                                            >
                                                          {/if}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  {/each}
                                                </div>
                                              </div>
                                            {/if}
                                            <!-- Jazz Metadata -->
                                            <div>
                                              <h4
                                                class="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider"
                                              >
                                                Jazz Metadata
                                              </h4>
                                              <div class="space-y-1 text-xs">
                                                <div>
                                                  <span class="font-semibold text-slate-600"
                                                    >ID:</span
                                                  >
                                                  <span
                                                    class="ml-2 font-mono text-slate-500 break-all break-words"
                                                    >{coValueProps.jazzMetadata.id}</span
                                                  >
                                                </div>
                                                {#if coValueProps.jazzMetadata.ownerInfo}
                                                  <div>
                                                    <span class="font-semibold text-slate-600"
                                                      >Owner:</span
                                                    >
                                                    <span class="ml-2 text-slate-500"
                                                      >{coValueProps.jazzMetadata.ownerInfo
                                                        .type}</span
                                                    >
                                                    <span
                                                      class="ml-2 font-mono text-xs text-slate-400"
                                                      >({coValueProps.jazzMetadata.ownerInfo.id.slice(
                                                        0,
                                                        8,
                                                      )}...)</span
                                                    >
                                                  </div>
                                                {/if}
                                                {#if coValueProps.jazzMetadata.keys.length > 0}
                                                  <div>
                                                    <span class="font-semibold text-slate-600"
                                                      >Keys:</span
                                                    >
                                                    <div class="flex flex-wrap gap-1 mt-1">
                                                      {#each coValueProps.jazzMetadata.keys as key}
                                                        <span
                                                          class="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600"
                                                          >{key}</span
                                                        >
                                                      {/each}
                                                    </div>
                                                  </div>
                                                {/if}
                                              </div>
                                            </div>
                                          </div>
                                        {/if}
                                      </div>
                                    {:else}
                                      <div class="text-sm">
                                        <div class="flex items-center gap-2">
                                          <span
                                            class="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600"
                                          >
                                            [{item.index}]
                                          </span>
                                          <span class="text-slate-700">
                                            {typeof item.value === "string"
                                              ? item.value
                                              : JSON.stringify(item.value)}
                                          </span>
                                        </div>
                                      </div>
                                    {/if}
                                  {/each}
                                </div>
                              {:else}
                                <div class="ml-4 text-sm text-slate-400 italic">Empty list</div>
                              {/if}
                            </div>
                          {:else if value.type === "CoMap"}
                            <!-- CoMap display with nested properties -->
                            <div class="space-y-2">
                              <div class="flex items-center gap-2">
                                <span
                                  class="font-mono text-xs bg-purple-100 px-2 py-0.5 rounded text-purple-700"
                                >
                                  CoMap
                                </span>
                                {#if value.id}
                                  <span class="ml-2 font-mono text-xs text-slate-500"
                                    >ID: {value.id.slice(0, 8)}...</span
                                  >
                                {/if}
                                {#if value.isLoaded !== undefined}
                                  <span class="text-xs text-slate-400">
                                    {value.isLoaded ? "✓ Loaded" : "⏳ Loading..."}
                                  </span>
                                {/if}
                              </div>
                              {#if value.properties && Object.keys(value.properties).length > 0}
                                <div class="ml-4 space-y-1 border-l-2 border-purple-200 pl-3">
                                  {#each Object.entries(value.properties) as [propKey, propValue]}
                                    <div class="text-xs">
                                      <div class="flex items-center gap-2">
                                        <span class="font-semibold text-slate-600">{propKey}:</span>
                                        <div class="flex-1 flex items-center gap-2">
                                          {#if typeof propValue === "object" && propValue !== null && "type" in propValue}
                                            {#if propValue.type === "ImageDefinition"}
                                              {#if propValue.isLoaded && propValue.imageDefinition}
                                                <div class="flex items-center gap-2">
                                                  <div
                                                    class="w-6 h-6 rounded overflow-hidden border border-slate-300 flex-shrink-0"
                                                  >
                                                    <Image
                                                      imageId={propValue.imageDefinition.$jazz.id}
                                                      width={24}
                                                      height={24}
                                                      alt={propKey}
                                                      class="object-cover w-full h-full"
                                                      loading="lazy"
                                                    />
                                                  </div>
                                                  <span
                                                    class="text-xs bg-green-100 px-1.5 py-0.5 rounded text-green-700"
                                                    >ImageDefinition</span
                                                  >
                                                  <span
                                                    class="ml-1 font-mono text-xs text-slate-400"
                                                    >({propValue.id?.slice(0, 8)}...)</span
                                                  >
                                                </div>
                                              {:else}
                                                <span
                                                  class="text-xs bg-green-100 px-1.5 py-0.5 rounded text-green-700"
                                                  >ImageDefinition</span
                                                >
                                                <span class="ml-1 text-xs text-slate-400"
                                                  >(Loading...)</span
                                                >
                                              {/if}
                                            {:else if propValue.type === "CoValue"}
                                              <span
                                                class="text-xs bg-purple-50 px-1 py-0.5 rounded text-purple-600"
                                                >CoValue</span
                                              >
                                              <span class="ml-1 font-mono text-xs text-slate-400"
                                                >({propValue.id?.slice(0, 8)}...)</span
                                              >
                                            {:else}
                                              <span class="text-slate-700 break-all break-words"
                                                >{JSON.stringify(propValue)}</span
                                              >
                                            {/if}
                                          {:else if typeof propValue === "string"}
                                            <span class="text-slate-700 break-all break-words"
                                              >{propValue || "(empty)"}</span
                                            >
                                          {:else}
                                            <span class="text-slate-700 break-all break-words"
                                              >{String(propValue)}</span
                                            >
                                          {/if}
                                        </div>
                                      </div>
                                    </div>
                                  {/each}
                                </div>
                              {:else if value.value !== undefined}
                                <div class="text-sm text-slate-600 italic ml-4">{value.value}</div>
                              {/if}
                            </div>
                          {:else if value.type === "CoValue"}
                            <!-- CoValue display -->
                            <div class="space-y-2">
                              <div class="flex items-center gap-2">
                                <span
                                  class="font-mono text-xs bg-purple-100 px-2 py-0.5 rounded text-purple-700"
                                >
                                  CoValue
                                </span>
                                {#if value.id}
                                  <span class="ml-2 font-mono text-xs text-slate-500"
                                    >ID: {value.id.slice(0, 8)}...</span
                                  >
                                {/if}
                                {#if value.isLoaded !== undefined}
                                  <span class="text-xs text-slate-400">
                                    {value.isLoaded ? "✓ Loaded" : "⏳ Loading..."}
                                  </span>
                                {/if}
                              </div>
                              {#if value.value !== undefined}
                                <div class="text-sm text-slate-600 italic ml-4">{value.value}</div>
                              {/if}
                            </div>
                          {/if}
                        {:else if typeof value === "string"}
                          <span class="text-sm text-slate-700">{value || "(empty)"}</span>
                        {:else if typeof value === "number" || typeof value === "boolean"}
                          <span class="text-sm font-mono text-slate-700">{String(value)}</span>
                        {:else if value === null}
                          <span class="text-sm text-slate-400 italic">null</span>
                        {:else if value === undefined}
                          <span class="text-sm text-slate-400 italic">undefined</span>
                        {:else}
                          <pre
                            class="text-xs text-slate-600 bg-slate-100/50 p-2 rounded overflow-x-auto">{JSON.stringify(
                              value,
                              null,
                              2,
                            )}</pre>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-sm text-slate-500 italic">No CoValues found</p>
            {/if}
          </div>

          <!-- Jazz Metadata -->
          <div>
            <h3 class="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wider">
              Jazz Metadata
            </h3>
            <div class="space-y-3">
              <div class="border-b border-slate-200/50 pb-3">
                <div class="flex items-start gap-3">
                  <span
                    class="text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[120px] shrink-0"
                  >
                    Root.O ID:
                  </span>
                  <span
                    class="text-sm font-mono text-slate-700 break-all break-words flex-1 min-w-0"
                    >{rootOData().jazzMetadata.id || "N/A"}</span
                  >
                </div>
              </div>
              <div class="border-b border-slate-200/50 pb-3">
                <div class="flex items-start gap-3">
                  <span
                    class="text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[120px]"
                  >
                    Owner:
                  </span>
                  <div class="flex-1">
                    {#if rootOData().jazzMetadata.ownerInfo}
                      <div class="space-y-1">
                        <span class="text-sm text-slate-700">
                          {rootOData().jazzMetadata.ownerInfo.type}
                        </span>
                        <div class="text-xs font-mono text-slate-500">
                          ID: {rootOData().jazzMetadata.ownerInfo.id.slice(0, 8)}...
                        </div>
                      </div>
                    {:else if rootOData().jazzMetadata.owner}
                      <span class="text-sm text-slate-700">
                        {String(rootOData().jazzMetadata.owner)}
                      </span>
                    {:else}
                      <span class="text-sm text-slate-400 italic">N/A</span>
                    {/if}
                  </div>
                </div>
              </div>
              <div class="border-b border-slate-200/50 pb-3">
                <div class="flex items-start gap-3">
                  <span
                    class="text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[120px]"
                  >
                    Keys:
                  </span>
                  <div class="flex-1">
                    {#if rootOData().jazzMetadata.keys.length > 0}
                      <div class="flex flex-wrap gap-2">
                        {#each rootOData().jazzMetadata.keys as key}
                          <span
                            class="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-700"
                            >{key}</span
                          >
                        {/each}
                      </div>
                    {:else}
                      <span class="text-sm text-slate-400 italic">No keys</span>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      {:else if me.$isLoaded && me.root?.o && !me.root.o.$isLoaded}
        <div
          class="p-8 rounded-3xl border border-dashed border-white bg-slate-50/40 text-center backdrop-blur-sm shadow-[0_0_6px_rgba(0,0,0,0.03)]"
        >
          <p class="text-sm text-slate-500">Loading root.o...</p>
        </div>
      {:else}
        <div
          class="p-8 rounded-3xl border border-dashed border-white bg-slate-50/40 text-center backdrop-blur-sm shadow-[0_0_6px_rgba(0,0,0,0.03)]"
        >
          <p class="text-sm text-slate-500">Root.O not available</p>
        </div>
      {/if}
    </section>
  {/if}
</div>
