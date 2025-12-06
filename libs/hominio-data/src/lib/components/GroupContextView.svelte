<script lang="ts">
  import { Group } from "jazz-tools";
  import Card from "./Card.svelte";
  import Badge from "./Badge.svelte";
  import { getCoValueGroupInfo } from "$lib/groups";
  import PropertyItem from "./PropertyItem.svelte";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    group: any; // Group CoValue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onNavigate?: (coValue: any, label?: string) => void;
  }

  let { group, onNavigate }: Props = $props();

  // Initial log to verify component is rendering
  console.log("[GroupContextView] Component initialized", {
    hasGroup: !!group,
    groupId: group?.$jazz?.id,
    isLoaded: group?.$isLoaded,
  });

  // Ensure Group is loaded
  $effect(() => {
    console.log("[GroupContextView] $effect running", {
      hasGroup: !!group,
      isLoaded: group?.$isLoaded,
    });

    if (group && !group.$isLoaded && group.$jazz?.ensureLoaded) {
      group.$jazz.ensureLoaded().catch((e: any) => {
        console.warn("Error loading group:", e);
      });
    }
  });

  // Debug: Log group info
  $effect(() => {
    if (group && group.$isLoaded) {
      const groupAny = group as any;
      const keys = allKeys();
      const hasEveryoneKey = keys.includes("everyone");
      let everyoneValue: any = null;

      // Try to get everyone value for debugging
      try {
        if (group.$jazz && typeof group.$jazz.get === "function") {
          everyoneValue = group.$jazz.get("everyone");
        } else if (groupAny.everyone !== undefined) {
          everyoneValue = groupAny.everyone;
        }
      } catch (e) {
        // Ignore
      }

      console.log("[GroupContextView] Group info:", {
        id: group.$jazz?.id,
        isLoaded: group.$isLoaded,
        keys: keys,
        hasEveryoneKey: hasEveryoneKey,
        everyoneValue: everyoneValue,
        hasProfile: groupAny.profile !== undefined,
        profileValue: groupAny.profile,
        hasRoot: groupAny.root !== undefined,
        rootValue: groupAny.root,
        profileRef: profileRef(),
        rootRef: rootRef(),
        accountMembers: accountMembers().length,
      });
    }
  });

  // Get group members directly from the Group
  const accountMembers = $derived(() => {
    console.log("[GroupContextView] accountMembers derived called", {
      hasGroup: !!group,
      isLoaded: group?.$isLoaded,
    });

    if (!group || !group.$isLoaded) return [];
    try {
      const groupAny = group as any;
      const members: Array<{ id: string; role: string }> = [];

      console.log("[GroupContextView] Starting member extraction", {
        hasMembersProperty: "members" in groupAny,
        hasGetMemberKeys: typeof groupAny.getMemberKeys === "function",
        hasRoleOf: typeof groupAny.roleOf === "function",
        hasGet: typeof groupAny.get === "function",
      });

      // First, try accessing members directly (like getCoValueGroupInfo does)
      if ("members" in groupAny && groupAny.members) {
        try {
          const membersArray = Array.from(groupAny.members || []);
          for (const member of membersArray) {
            const memberAny = member as any;
            if (memberAny && memberAny.account) {
              const memberId = memberAny.account.$jazz?.id;
              if (memberId) {
                const role =
                  typeof groupAny.getRoleOf === "function"
                    ? groupAny.getRoleOf(memberId)
                    : typeof groupAny.roleOf === "function"
                      ? groupAny.roleOf(memberId)
                      : null;
                if (role && role !== "revoked") {
                  members.push({ id: memberId, role });
                }
              }
            }
          }
        } catch (e: any) {
          console.warn("Error accessing members property:", e);
        }
      }

      // Also try Group API methods
      if (typeof groupAny.getMemberKeys === "function") {
        const memberKeys = groupAny.getMemberKeys();
        for (const memberKey of memberKeys) {
          // Skip if we already have this member from members property
          if (members.some((m) => m.id === memberKey)) continue;

          try {
            const role = typeof groupAny.roleOf === "function" ? groupAny.roleOf(memberKey) : null;
            if (role && role !== "revoked") {
              members.push({ id: memberKey, role });
            }
          } catch (e: any) {
            console.warn(`Error getting role for member ${memberKey}:`, e);
          }
        }
      }

      // Fallback: try to extract members from keys (including "everyone")
      if (members.length === 0) {
        const allKeysList = allKeys();
        for (const key of allKeysList) {
          // Check for "everyone" separately (it's a special case)
          if (key === "everyone") {
            try {
              let role: string | null = null;
              // Try Group's direct get() method first
              if (typeof groupAny.get === "function") {
                role = groupAny.get("everyone") || null;
              } else if (group.$jazz && typeof group.$jazz.get === "function") {
                role = group.$jazz.get("everyone") || null;
              } else if ((group as any).everyone !== undefined) {
                role = (group as any).everyone || null;
              }
              if (role && typeof role === "string" && role !== "revoked") {
                members.push({ id: "everyone", role });
              }
            } catch (e: any) {
              console.warn("Error extracting everyone from keys:", e);
            }
            continue; // Skip to next key
          }

          // Member keys start with "co_" (account IDs) or are agent IDs
          if (
            typeof key === "string" &&
            (key.startsWith("co_") ||
              (key.length > 0 &&
                !key.startsWith("parent_") &&
                !key.startsWith("child_") &&
                !key.startsWith("writeKeyFor_") &&
                !key.includes("_for_") &&
                key !== "readKey" &&
                key !== "profile" &&
                key !== "root"))
          ) {
            try {
              // Try to get the role value directly
              let role: string | null = null;
              // Try Group's direct get() method first
              if (typeof groupAny.get === "function") {
                role = groupAny.get(key) || null;
              } else if (group.$jazz && typeof group.$jazz.get === "function") {
                role = group.$jazz.get(key) || null;
              } else if ((group as any)[key] !== undefined) {
                role = (group as any)[key] || null;
              }
              if (role && typeof role === "string" && role !== "revoked") {
                members.push({ id: key, role });
              }
            } catch (e: any) {
              // Ignore errors for individual keys
            }
          }
        }
      }

      // Always check "everyone" role - it should be included if set
      // According to Group API, "everyone" is stored as a direct key-value pair in the Group CoMap
      console.log("[GroupContextView] Checking everyone role...");
      try {
        let everyoneRoleValue: string | null = null;

        // First, check if "everyone" exists as a key in the Group CoMap
        const allKeysList = allKeys();
        console.log("[GroupContextView] All keys:", allKeysList);
        const hasEveryoneKey = allKeysList.includes("everyone");
        console.log("[GroupContextView] Has everyone key:", hasEveryoneKey);

        if (hasEveryoneKey) {
          // Try to get the value directly from the Group CoMap
          try {
            // Method 1: Try Group's direct get() method (Groups extend CoMap, so they have get())
            if (typeof groupAny.get === "function") {
              try {
                const value = groupAny.get("everyone");
                if (value && typeof value === "string") {
                  everyoneRoleValue = value;
                }
              } catch (e) {
                // Ignore
              }
            }

            // Method 2: Try $jazz.get (fallback)
            if (!everyoneRoleValue && group.$jazz && typeof group.$jazz.get === "function") {
              try {
                const value = group.$jazz.get("everyone");
                if (value && typeof value === "string") {
                  everyoneRoleValue = value;
                }
              } catch (e) {
                // Ignore
              }
            }

            // Method 3: Try direct property access
            if (!everyoneRoleValue && (group as any).everyone !== undefined) {
              const value = (group as any).everyone;
              if (value && typeof value === "string") {
                everyoneRoleValue = value;
              }
            }

            // Method 4: Try roleOf API method (this should work according to Group API)
            if (!everyoneRoleValue && typeof groupAny.roleOf === "function") {
              try {
                const value = groupAny.roleOf("everyone");
                if (value && typeof value === "string") {
                  everyoneRoleValue = value;
                }
              } catch (e) {
                console.warn("Error calling roleOf('everyone'):", e);
              }
            }

            // Method 5: Try getRoleOf if available
            if (!everyoneRoleValue && typeof groupAny.getRoleOf === "function") {
              try {
                const value = groupAny.getRoleOf("everyone");
                if (value && typeof value === "string") {
                  everyoneRoleValue = value;
                }
              } catch (e) {
                // Ignore
              }
            }
          } catch (e) {
            console.warn("Error accessing everyone key:", e);
          }
        }

        // If we found an everyone role and it's not revoked, add it
        if (
          everyoneRoleValue &&
          typeof everyoneRoleValue === "string" &&
          everyoneRoleValue !== "revoked"
        ) {
          // Remove any existing "everyone" entry first
          const existingIndex = members.findIndex((m) => m.id === "everyone");
          if (existingIndex >= 0) {
            members[existingIndex] = { id: "everyone", role: everyoneRoleValue };
          } else {
            members.push({ id: "everyone", role: everyoneRoleValue });
          }
          console.log("[GroupContextView] ✅ Successfully added everyone role:", everyoneRoleValue);
        } else if (hasEveryoneKey && !everyoneRoleValue) {
          // Debug: log if key exists but we couldn't get the value
          console.warn("[GroupContextView] ⚠️ Found 'everyone' key but couldn't get value", {
            hasGet: typeof groupAny.get === "function",
            hasJazzGet: typeof group.$jazz?.get === "function",
            hasRoleOf: typeof groupAny.roleOf === "function",
            directProperty: (group as any).everyone,
            allKeys: allKeysList,
            groupType: typeof group,
            groupKeys: Object.keys(group).filter((k) => !k.startsWith("$")),
          });
        } else if (!hasEveryoneKey) {
          console.log("[GroupContextView] ℹ️ 'everyone' key not found in keys:", allKeysList);
        }
      } catch (e: any) {
        console.warn("Error checking everyone role:", e);
      }

      return members;
    } catch (e: any) {
      console.warn("Error getting account members:", e);
      return [];
    }
  });

  // Get current user's role
  const myRole = $derived(() => {
    if (!group || !group.$isLoaded) return null;
    try {
      const groupAny = group as any;
      if (typeof groupAny.myRole === "function") {
        return groupAny.myRole() || null;
      }
      return null;
    } catch (e: any) {
      console.warn("Error getting myRole:", e);
      return null;
    }
  });

  // Get all member keys (direct members)
  const memberKeys = $derived(() => {
    if (!group || !group.$isLoaded) return [];
    try {
      const groupAny = group as any;
      if (typeof groupAny.getMemberKeys === "function") {
        return groupAny.getMemberKeys();
      }
      return [];
    } catch (e: any) {
      console.warn("Error getting member keys:", e);
      return [];
    }
  });

  // Get all member keys including inherited
  const allMemberKeys = $derived(() => {
    if (!group || !group.$isLoaded) return new Set<string>();
    try {
      const groupAny = group as any;
      if (typeof groupAny.getAllMemberKeysSet === "function") {
        return groupAny.getAllMemberKeysSet();
      }
      return new Set<string>();
    } catch (e: any) {
      console.warn("Error getting all member keys:", e);
      return new Set<string>();
    }
  });

  // Get parent groups
  const parentGroups = $derived(() => {
    if (!group || !group.$isLoaded) return [];
    try {
      const groupAny = group as any;
      if (typeof groupAny.getParentGroups === "function") {
        return groupAny.getParentGroups();
      }
      return [];
    } catch (e: any) {
      console.warn("Error getting parent groups:", e);
      return [];
    }
  });

  // Get members from parent groups
  const parentGroupMembers = $derived(() => {
    const parents = parentGroups();
    if (parents.length === 0) return [];

    const allMembers: Array<{
      groupId: string;
      groupLabel: string;
      members: Array<{ id: string; role: string }>;
    }> = [];

    for (const parentGroup of parents) {
      try {
        const parentAny = parentGroup as any;
        const members: Array<{ id: string; role: string }> = [];

        // Try accessing members directly
        if ("members" in parentAny && parentAny.members) {
          try {
            const membersArray = Array.from(parentAny.members || []);
            for (const member of membersArray) {
              const memberAny = member as any;
              if (memberAny && memberAny.account) {
                const memberId = memberAny.account.$jazz?.id;
                if (memberId) {
                  const role =
                    typeof parentAny.getRoleOf === "function"
                      ? parentAny.getRoleOf(memberId)
                      : typeof parentAny.roleOf === "function"
                        ? parentAny.roleOf(memberId)
                        : null;
                  if (role && role !== "revoked") {
                    members.push({ id: memberId, role });
                  }
                }
              }
            }
          } catch (e: any) {
            console.warn("Error accessing parent group members:", e);
          }
        }

        // Also try Group API methods
        if (typeof parentAny.getMemberKeys === "function") {
          const memberKeys = parentAny.getMemberKeys();
          for (const memberKey of memberKeys) {
            if (members.some((m) => m.id === memberKey)) continue;

            try {
              const role =
                typeof parentAny.roleOf === "function" ? parentAny.roleOf(memberKey) : null;
              if (role && role !== "revoked") {
                members.push({ id: memberKey, role });
              }
            } catch (e: any) {
              // Ignore errors
            }
          }
        }

        if (members.length > 0) {
          allMembers.push({
            groupId: parentGroup.$jazz?.id || "unknown",
            groupLabel: parentGroup.$jazz?.id?.slice(0, 16) + "..." || "unknown",
            members,
          });
        }
      } catch (e: any) {
        console.warn("Error getting members from parent group:", e);
      }
    }

    return allMembers;
  });

  // Get child groups (groups that extend this group)
  const childGroups = $derived(() => {
    if (!group || !group.$isLoaded) return [];
    try {
      const groupAny = group as any;
      const children: any[] = [];
      if (typeof groupAny.forEachChildGroup === "function") {
        groupAny.forEachChildGroup((child: any) => {
          children.push(child);
        });
      }
      return children;
    } catch (e: any) {
      console.warn("Error getting child groups:", e);
      return [];
    }
  });

  // Get members from child groups
  const childGroupMembers = $derived(() => {
    const children = childGroups();
    if (children.length === 0) return [];

    const allMembers: Array<{
      groupId: string;
      groupLabel: string;
      members: Array<{ id: string; role: string }>;
    }> = [];

    for (const childGroup of children) {
      try {
        const childAny = childGroup as any;
        const members: Array<{ id: string; role: string }> = [];

        // Try accessing members directly
        if ("members" in childAny && childAny.members) {
          try {
            const membersArray = Array.from(childAny.members || []);
            for (const member of membersArray) {
              const memberAny = member as any;
              if (memberAny && memberAny.account) {
                const memberId = memberAny.account.$jazz?.id;
                if (memberId) {
                  const role =
                    typeof childAny.getRoleOf === "function"
                      ? childAny.getRoleOf(memberId)
                      : typeof childAny.roleOf === "function"
                        ? childAny.roleOf(memberId)
                        : null;
                  if (role && role !== "revoked") {
                    members.push({ id: memberId, role });
                  }
                }
              }
            }
          } catch (e: any) {
            console.warn("Error accessing child group members:", e);
          }
        }

        // Also try Group API methods
        if (typeof childAny.getMemberKeys === "function") {
          const memberKeys = childAny.getMemberKeys();
          for (const memberKey of memberKeys) {
            if (members.some((m) => m.id === memberKey)) continue;

            try {
              const role =
                typeof childAny.roleOf === "function" ? childAny.roleOf(memberKey) : null;
              if (role && role !== "revoked") {
                members.push({ id: memberKey, role });
              }
            } catch (e: any) {
              // Ignore errors
            }
          }
        }

        if (members.length > 0) {
          allMembers.push({
            groupId: childGroup.$jazz?.id || "unknown",
            groupLabel: childGroup.$jazz?.id?.slice(0, 16) + "..." || "unknown",
            members,
          });
        }
      } catch (e: any) {
        console.warn("Error getting members from child group:", e);
      }
    }

    return allMembers;
  });

  // Get profile reference (could be CoID string or CoValue)
  const profileRef = $derived(() => {
    if (!group || !group.$isLoaded) return null;
    try {
      // Try multiple ways to access the profile
      const groupAny = group as any;

      // Check if profile exists as a property
      if (groupAny.profile !== undefined && groupAny.profile !== null) {
        return groupAny.profile;
      }

      // Try via $jazz.get
      if (group.$jazz && typeof group.$jazz.get === "function") {
        try {
          const profile = group.$jazz.get("profile");
          if (profile !== undefined && profile !== null) {
            return profile;
          }
        } catch (e) {
          // Ignore - try next method
        }
      }

      // Try via $jazz.has
      if (group.$jazz && typeof group.$jazz.has === "function" && group.$jazz.has("profile")) {
        return groupAny.profile || null;
      }

      return null;
    } catch (e) {
      console.warn("Error getting profile ref:", e);
      return null;
    }
  });

  // Load profile CoValue if it exists
  const profileCoValue = $derived(() => {
    const ref = profileRef();
    if (!ref) return null;

    try {
      // If it's already a CoValue object, return it
      if (ref && typeof ref === "object" && "$jazz" in ref) {
        return ref;
      }

      // If it's a CoID string, we can't easily load it without knowing the schema
      // But we can still show the ID and let navigation handle it
      return null;
    } catch (e: any) {
      console.warn("Error loading profile CoValue:", e);
      return null;
    }
  });

  // Ensure profile is loaded if it's a CoValue
  $effect(() => {
    const profile = profileCoValue();
    if (profile && !profile.$isLoaded && profile.$jazz?.ensureLoaded) {
      profile.$jazz.ensureLoaded().catch((e: any) => {
        console.warn("Error loading profile:", e);
      });
    }
  });

  // Get root reference
  const rootRef = $derived(() => {
    if (!group || !group.$isLoaded) return null;
    try {
      const groupAny = group as any;

      // Check if root exists as a property
      if (groupAny.root !== undefined && groupAny.root !== null) {
        return groupAny.root;
      }

      // Try via $jazz.get
      if (group.$jazz && typeof group.$jazz.get === "function") {
        try {
          const root = group.$jazz.get("root");
          if (root !== undefined && root !== null) {
            return root;
          }
        } catch (e) {
          // Ignore - try next method
        }
      }

      // Try via $jazz.has
      if (group.$jazz && typeof group.$jazz.has === "function" && group.$jazz.has("root")) {
        return groupAny.root || null;
      }

      return null;
    } catch (e) {
      console.warn("Error getting root ref:", e);
      return null;
    }
  });

  // Get read key ID
  const readKeyId = $derived(() => {
    if (!group || !group.$isLoaded) return null;
    try {
      // Try multiple ways to access the readKey
      if (group.$jazz && typeof group.$jazz.get === "function") {
        return group.$jazz.get("readKey") || null;
      }
      if (group.$jazz && typeof group.$jazz.has === "function" && group.$jazz.has("readKey")) {
        return group.readKey || null;
      }
      return group.readKey || null;
    } catch (e) {
      console.warn("Error getting readKey:", e);
      return null;
    }
  });

  // Get current read key ID
  const currentReadKeyId = $derived(() => {
    if (!group || !group.$isLoaded) return null;
    try {
      const groupAny = group as any;
      if (typeof groupAny.getCurrentReadKeyId === "function") {
        return groupAny.getCurrentReadKeyId() || null;
      }
      return null;
    } catch (e: any) {
      console.warn("Error getting current read key ID:", e);
      return null;
    }
  });

  // Get all keys from the group
  const allKeys = $derived(() => {
    if (!group || !group.$isLoaded) return [];
    try {
      let keys: string[] = [];

      // Method 1: Try $jazz.keys() (most reliable for CoMaps)
      if (group.$jazz && typeof group.$jazz.keys === "function") {
        keys = Array.from(group.$jazz.keys());
        console.log("[GroupContextView] Got keys from $jazz.keys():", keys);
      }

      // Method 2: Try Object.keys() as fallback
      if (keys.length === 0) {
        keys = Object.keys(group).filter((k) => !k.startsWith("$") && k !== "constructor");
        console.log("[GroupContextView] Got keys from Object.keys():", keys);
      }

      // Method 3: Try Group's direct keys() method if available
      const groupAny = group as any;
      if (keys.length === 0 && typeof groupAny.keys === "function") {
        try {
          keys = Array.from(groupAny.keys());
          console.log("[GroupContextView] Got keys from group.keys():", keys);
        } catch (e) {
          // Ignore
        }
      }

      console.log(
        "[GroupContextView] Final allKeys result:",
        keys,
        "includes 'everyone':",
        keys.includes("everyone"),
      );
      return keys;
    } catch (e) {
      console.warn("[GroupContextView] Error getting keys:", e);
      return [];
    }
  });

  // Get everyone role
  const everyoneRole = $derived(() => {
    if (!group || !group.$isLoaded) return null;
    try {
      // Try multiple ways to access everyone role
      if (group.$jazz && typeof group.$jazz.get === "function") {
        return group.$jazz.get("everyone") || null;
      }
      if (group.$jazz && typeof group.$jazz.has === "function" && group.$jazz.has("everyone")) {
        return group.everyone || null;
      }
      return group.everyone || null;
    } catch (e) {
      console.warn("Error getting everyone role:", e);
      return null;
    }
  });

  // Handle navigation
  function handleNavigate(coValue: any, label?: string) {
    if (onNavigate) {
      onNavigate(coValue, label);
    }
  }
</script>

{#if !group || !group.$isLoaded}
  <div class="text-center">
    <p class="text-sm text-slate-500">Loading group...</p>
  </div>
{:else}
  <div class="space-y-6">
    <!-- Group ID - Always show this -->
    <Card>
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-slate-700">Group Information</h3>
        <PropertyItem propKey="Group ID" propValue={group.$jazz?.id || "unknown"} />
        {#if myRole()}
          <PropertyItem propKey="Your Role" propValue={myRole() || "none"} />
        {/if}
        {#if everyoneRole()}
          <PropertyItem propKey="Everyone Role" propValue={everyoneRole() || "none"} />
        {/if}
      </div>
    </Card>

    <!-- Members -->
    <Card>
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-slate-700">Members</h3>
        {#if accountMembers().length > 0}
          <div class="space-y-2">
            {#each accountMembers() as member}
              <div class="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                <span class="text-sm font-mono text-slate-700">
                  {member.id === "everyone" ? "everyone" : member.id.slice(0, 16) + "..."}
                </span>
                <Badge type={member.role.toLowerCase()} variant="role">{member.role}</Badge>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-sm text-slate-500 italic">No members found</p>
        {/if}
      </div>
    </Card>

    <!-- Parent Groups -->
    {#if parentGroups().length > 0}
      <Card>
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-700">Parent Groups</h3>
          <div class="space-y-4">
            {#each parentGroups() as parentGroup}
              <div class="space-y-2">
                <div class="flex items-center justify-between p-2 bg-slate-100 rounded-lg">
                  <span class="text-sm font-mono text-slate-700 font-semibold"
                    >{parentGroup.$jazz?.id?.slice(0, 16) || "unknown"}...</span
                  >
                  {#if onNavigate}
                    <button
                      type="button"
                      onclick={() => handleNavigate(parentGroup, "Parent Group")}
                      class="text-xs text-blue-600 hover:text-blue-800"
                    >
                      View →
                    </button>
                  {/if}
                </div>
                {#if parentGroupMembers().find((p) => p.groupId === parentGroup.$jazz?.id)}
                  {@const groupMembers = parentGroupMembers().find(
                    (p) => p.groupId === parentGroup.$jazz?.id,
                  )!}
                  {#if groupMembers.members.length > 0}
                    <div class="ml-4 space-y-1">
                      {#each groupMembers.members as member}
                        <div class="flex items-center justify-between p-1.5 bg-slate-50 rounded">
                          <span class="text-xs font-mono text-slate-600">
                            {member.id === "everyone" ? "everyone" : member.id.slice(0, 16) + "..."}
                          </span>
                          <Badge type={member.role.toLowerCase()} variant="role"
                            >{member.role}</Badge
                          >
                        </div>
                      {/each}
                    </div>
                  {/if}
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </Card>
    {/if}

    <!-- Child Groups -->
    {#if childGroups().length > 0}
      <Card>
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-700">Child Groups</h3>
          <div class="space-y-4">
            {#each childGroups() as childGroup}
              <div class="space-y-2">
                <div class="flex items-center justify-between p-2 bg-slate-100 rounded-lg">
                  <span class="text-sm font-mono text-slate-700 font-semibold"
                    >{childGroup.$jazz?.id?.slice(0, 16) || "unknown"}...</span
                  >
                  {#if onNavigate}
                    <button
                      type="button"
                      onclick={() => handleNavigate(childGroup, "Child Group")}
                      class="text-xs text-blue-600 hover:text-blue-800"
                    >
                      View →
                    </button>
                  {/if}
                </div>
                {#if childGroupMembers().find((c) => c.groupId === childGroup.$jazz?.id)}
                  {@const groupMembers = childGroupMembers().find(
                    (c) => c.groupId === childGroup.$jazz?.id,
                  )!}
                  {#if groupMembers.members.length > 0}
                    <div class="ml-4 space-y-1">
                      {#each groupMembers.members as member}
                        <div class="flex items-center justify-between p-1.5 bg-slate-50 rounded">
                          <span class="text-xs font-mono text-slate-600">
                            {member.id === "everyone" ? "everyone" : member.id.slice(0, 16) + "..."}
                          </span>
                          <Badge type={member.role.toLowerCase()} variant="role"
                            >{member.role}</Badge
                          >
                        </div>
                      {/each}
                    </div>
                  {/if}
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </Card>
    {/if}

    <!-- Profile -->
    {#if profileRef()}
      <Card>
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-700">Profile</h3>
          {#if profileCoValue() && profileCoValue()!.$isLoaded}
            {@const profile = profileCoValue()!}
            <div class="space-y-3">
              <PropertyItem
                propKey="Profile ID"
                propValue={profile.$jazz?.id || "unknown"}
                showCopyButton={true}
                copyValue={profile.$jazz?.id}
              />
              {#if profile.$jazz?.has && typeof profile.$jazz.has === "function"}
                {#if profile.$jazz.has("name")}
                  <PropertyItem propKey="Name" propValue={profile.name || "Not set"} />
                {/if}
                {#if profile.$jazz.has("email")}
                  <PropertyItem propKey="Email" propValue={profile.email || "Not set"} />
                {/if}
                {#if profile.$jazz.has("avatar")}
                  <PropertyItem propKey="Has Avatar" propValue="Yes" />
                {/if}
              {/if}
              {#if onNavigate}
                <button
                  type="button"
                  onclick={() => handleNavigate(profile, "Profile")}
                  class="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  View Profile →
                </button>
              {/if}
            </div>
          {:else if profileCoValue() && !profileCoValue()!.$isLoaded}
            <div class="space-y-3">
              <div class="text-sm text-slate-500">Loading profile...</div>
              <PropertyItem
                propKey="Profile ID"
                propValue={profileCoValue()!.$jazz?.id || "unknown"}
                showCopyButton={true}
                copyValue={profileCoValue()!.$jazz?.id}
              />
            </div>
          {:else if typeof profileRef() === "string"}
            {@const profileId = profileRef() as string}
            <div class="space-y-3">
              <PropertyItem
                propKey="Profile ID"
                propValue={profileId.length > 16 ? profileId.slice(0, 16) + "..." : profileId}
                showCopyButton={true}
                copyValue={profileId}
              />
              <p class="text-xs text-slate-400 italic">Profile reference found (CoID string)</p>
            </div>
          {:else}
            <div class="space-y-3">
              <PropertyItem
                propKey="Profile ID"
                propValue={profileRef()?.$jazz?.id
                  ? profileRef()!.$jazz.id.length > 16
                    ? profileRef()!.$jazz.id.slice(0, 16) + "..."
                    : profileRef()!.$jazz.id
                  : "unknown"}
                showCopyButton={!!profileRef()?.$jazz?.id}
                copyValue={profileRef()?.$jazz?.id}
              />
              <p class="text-xs text-slate-400 italic">
                Profile reference found (not a CoValue object)
              </p>
            </div>
          {/if}
        </div>
      </Card>
    {/if}

    <!-- References -->
    {#if rootRef()}
      <Card>
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-700">References</h3>
          <PropertyItem propKey="Root" propValue={rootRef()?.slice(0, 16) + "..." || "none"} />
        </div>
      </Card>
    {/if}

    <!-- Keys -->
    {#if readKeyId() || currentReadKeyId()}
      <Card>
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-700">Keys</h3>
          {#if readKeyId()}
            <PropertyItem
              propKey="Read Key ID"
              propValue={readKeyId()?.slice(0, 16) + "..." || "none"}
            />
          {/if}
          {#if currentReadKeyId()}
            <PropertyItem
              propKey="Current Read Key ID"
              propValue={currentReadKeyId()?.slice(0, 16) + "..." || "none"}
            />
          {/if}
        </div>
      </Card>
    {/if}

    <!-- Member Keys Summary -->
    {#if memberKeys().length > 0 || allMemberKeys().size > 0}
      <Card>
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-700">Member Keys</h3>
          <PropertyItem propKey="Direct Members" propValue={memberKeys().length.toString()} />
          <PropertyItem
            propKey="Total Members (including inherited)"
            propValue={allMemberKeys().size.toString()}
          />
        </div>
      </Card>
    {/if}
  </div>
{/if}
