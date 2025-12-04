<script lang="ts">
  import { JazzAccount } from "$lib/schema";
  import { AccountCoState } from "jazz-tools/svelte";
  import { authClient } from "$lib/auth-client";
  import { migrateAddAvatarToHumans } from "$lib/migrations/20241220_add-avatar-to-humans.js";

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

  // Migration state
  let isMigrating = $state(false);
  let migrationStatus = $state<string | null>(null);

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
                        ? item.name || item["@label"] || item.$jazz?.id?.slice(0, 8) || "CoValue"
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
                // Try to get keys from the nested CoMap
                const nestedKeys = Object.keys(value).filter(
                  (k) => !k.startsWith("$") && k !== "constructor",
                );
                
                // If no keys found, try $jazz.keys()
                if (nestedKeys.length === 0 && value.$jazz && typeof value.$jazz.keys === "function") {
                  nestedKeys.push(...Array.from(value.$jazz.keys()));
                }

                // Extract nested properties
                for (const nestedKey of nestedKeys) {
                  try {
                    const nestedValue = value[nestedKey];
                    // Handle nested CoValues recursively
                    if (nestedValue && typeof nestedValue === "object" && "$jazz" in nestedValue) {
                      nestedProperties[nestedKey] = {
                        type: "CoValue",
                        id: nestedValue.$jazz?.id || "unknown",
                        isLoaded: nestedValue.$isLoaded || false,
                        value: nestedValue.$isLoaded ? String(nestedValue) : "Loading...",
                      };
                    } else {
                      nestedProperties[nestedKey] = nestedValue;
                    }
                  } catch {
                    // Skip inaccessible properties
                  }
                }
              } catch (e) {
                console.warn(`Error extracting nested properties from ${key}:`, e);
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

  // Function to manually trigger migration
  async function triggerMigration() {
    if (!me.$isLoaded || isMigrating) {
      return;
    }

    isMigrating = true;
    migrationStatus = "Running migration...";

    try {
      // Use me directly as it's the loaded account instance
      await migrateAddAvatarToHumans(me);
      migrationStatus = "Migration completed successfully!";
      
      // Clear status after 3 seconds
      setTimeout(() => {
        migrationStatus = null;
      }, 3000);
    } catch (error) {
      console.error("Migration error:", error);
      migrationStatus = `Error: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isMigrating = false;
    }
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
                        ? item.name || item["@label"] || item.$jazz?.id?.slice(0, 8) || "CoValue"
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
                // Try to get keys from the nested CoMap
                const nestedKeys = Object.keys(value).filter(
                  (k) => !k.startsWith("$") && k !== "constructor",
                );
                
                // If no keys found, try $jazz.keys()
                if (nestedKeys.length === 0 && value.$jazz && typeof value.$jazz.keys === "function") {
                  nestedKeys.push(...Array.from(value.$jazz.keys()));
                }

                // Extract nested properties
                for (const nestedKey of nestedKeys) {
                  try {
                    const nestedValue = value[nestedKey];
                    // Handle nested CoValues recursively
                    if (nestedValue && typeof nestedValue === "object" && "$jazz" in nestedValue) {
                      nestedProperties[nestedKey] = {
                        type: "CoValue",
                        id: nestedValue.$jazz?.id || "unknown",
                        isLoaded: nestedValue.$isLoaded || false,
                        value: nestedValue.$isLoaded ? String(nestedValue) : "Loading...",
                      };
                    } else {
                      nestedProperties[nestedKey] = nestedValue;
                    }
                  } catch {
                    // Skip inaccessible properties
                  }
                }
              } catch (e) {
                console.warn(`Error extracting nested properties from ${key}:`, e);
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
      <div class="flex items-center justify-between mb-4">
        <div class="flex-1"></div>
        <div class="flex-1 text-center">
          <h1
            class="text-4xl font-bold bg-clip-text text-transparent bg-linear-to-br from-slate-700 to-slate-800 tracking-tight"
          >
            Data Explorer
          </h1>
          <p class="mt-2 text-sm text-slate-500">Explore your Jazz account profile and root data</p>
        </div>
        <div class="flex-1 flex justify-end">
          <button
            type="button"
            onclick={triggerMigration}
            disabled={isMigrating || !me.$isLoaded}
            class="px-4 py-2 rounded-full bg-[#002455] hover:bg-[#002455] disabled:opacity-50 border border-[#001a3d] text-white text-xs font-semibold transition-all duration-300 shadow-[0_0_6px_rgba(0,0,0,0.15)] hover:shadow-[0_0_8px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
            title="Manually trigger data migrations"
          >
            {#if isMigrating}
              <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Running...
            {:else}
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Run Migrations
            {/if}
          </button>
        </div>
      </div>
      {#if migrationStatus}
        <div
          class="mt-4 px-4 py-2 rounded-lg {migrationStatus.startsWith('Error')
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-green-50 border border-green-200 text-green-700'}"
        >
          <p class="text-sm font-medium">{migrationStatus}</p>
        </div>
      {/if}
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
            <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <div class="flex items-start gap-3 py-2 border-b border-slate-200/50 last:border-b-0">
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
                      <span class="text-sm text-slate-700 break-all break-words">{String(value)}</span
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
                                                                  <div class="ml-3 mt-1 space-y-1 border-l-2 border-purple-200 pl-2">
                                                                    {#each Object.entries(propValue.properties) as [nestedKey, nestedValue]}
                                                                      <div class="text-xs">
                                                                        <span class="font-semibold text-slate-600">{nestedKey}:</span>
                                                                        <span class="ml-2 text-slate-700 break-all break-words">
                                                                          {#if typeof nestedValue === "object" && nestedValue !== null && "type" in nestedValue}
                                                                            {#if nestedValue.type === "CoValue"}
                                                                              <span class="text-xs bg-purple-50 px-1 py-0.5 rounded text-purple-600">CoValue</span>
                                                                              <span class="ml-1 font-mono text-xs text-slate-400">({nestedValue.id?.slice(0, 8)}...)</span>
                                                                            {:else}
                                                                              {JSON.stringify(nestedValue)}
                                                                            {/if}
                                                                          {:else if typeof nestedValue === "string"}
                                                                            {nestedValue || "(empty)"}
                                                                          {:else}
                                                                            {String(nestedValue)}
                                                                          {/if}
                                                                        </span>
                                                                      </div>
                                                                    {/each}
                                                                  </div>
                                                                {:else}
                                                                  <span class="ml-2 text-xs text-slate-400 italic">(empty)</span>
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
                                      <span class="font-semibold text-slate-600">{propKey}:</span>
                                      <span class="ml-2 text-slate-700 break-all break-words">
                                        {#if typeof propValue === "object" && propValue !== null && "type" in propValue}
                                          {#if propValue.type === "CoValue"}
                                            <span class="text-xs bg-purple-50 px-1 py-0.5 rounded text-purple-600">CoValue</span>
                                            <span class="ml-1 font-mono text-xs text-slate-400">({propValue.id?.slice(0, 8)}...)</span>
                                          {:else}
                                            {JSON.stringify(propValue)}
                                          {/if}
                                        {:else if typeof propValue === "string"}
                                          {propValue || "(empty)"}
                                        {:else}
                                          {String(propValue)}
                                        {/if}
                                      </span>
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
