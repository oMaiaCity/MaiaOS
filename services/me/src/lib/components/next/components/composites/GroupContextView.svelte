<script lang="ts">
  import Card from "../leafs/Card.svelte";
  import Badge from "../leafs/Badge.svelte";
  import PropertyItem from "./PropertyItem.svelte";
  import {
    getGroupMembers,
    getMyRole,
    getParentGroups,
    getChildGroups,
    getMemberKeys,
    getAllMemberKeys,
    getEveryoneRole,
  } from "../../logic/groupInfo.js";
  import { ensureLoaded } from "../../logic/coValueLoader.js";
  import { formatCoValueId } from "../../utilities/coValueFormatter.js";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    group: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onNavigate?: (coValue: any, label?: string) => void;
  }

  let { group, onNavigate }: Props = $props();

  // Ensure Group is loaded
  $effect(() => {
    if (group && !group.$isLoaded && group.$jazz?.ensureLoaded) {
      ensureLoaded(group).catch((e) => console.warn("Error loading group:", e));
    }
  });

  const accountMembers = $derived(() => getGroupMembers(group));
  const myRole = $derived(() => getMyRole(group));
  const everyoneRole = $derived(() => getEveryoneRole(group));
  const parentGroups = $derived(() => getParentGroups(group));
  const childGroups = $derived(() => getChildGroups(group));
  const memberKeys = $derived(() => getMemberKeys(group));
  const allMemberKeys = $derived(() => getAllMemberKeys(group));

  // Get parent group members
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
        const members = getGroupMembers(parentGroup);
        if (members.length > 0) {
          allMembers.push({
            groupId: parentGroup.$jazz?.id || "unknown",
            groupLabel: formatCoValueId(parentGroup.$jazz?.id || "unknown", 16),
            members,
          });
        }
      } catch (e: any) {
        console.warn("Error getting members from parent group:", e);
      }
    }

    return allMembers;
  });

  // Get child group members
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
        const members = getGroupMembers(childGroup);
        if (members.length > 0) {
          allMembers.push({
            groupId: childGroup.$jazz?.id || "unknown",
            groupLabel: formatCoValueId(childGroup.$jazz?.id || "unknown", 16),
            members,
          });
        }
      } catch (e: any) {
        console.warn("Error getting members from child group:", e);
      }
    }

    return allMembers;
  });

  // Get profile reference
  const profileRef = $derived(() => {
    if (!group || !group.$isLoaded) return null;
    try {
      const groupAny = group as any;
      if (groupAny.profile !== undefined && groupAny.profile !== null) {
        return groupAny.profile;
      }
      if (group.$jazz && typeof group.$jazz.get === "function") {
        try {
          const profile = group.$jazz.get("profile");
          if (profile !== undefined && profile !== null) {
            return profile;
          }
        } catch (e) {
          // Ignore
        }
      }
      if (group.$jazz && typeof group.$jazz.has === "function" && group.$jazz.has("profile")) {
        return groupAny.profile || null;
      }
      return null;
    } catch (e) {
      console.warn("Error getting profile ref:", e);
      return null;
    }
  });

  const profileCoValue = $derived(() => {
    const ref = profileRef();
    if (!ref) return null;
    try {
      if (ref && typeof ref === "object" && "$jazz" in ref) {
        return ref;
      }
      return null;
    } catch (e: any) {
      console.warn("Error loading profile CoValue:", e);
      return null;
    }
  });

  $effect(() => {
    const profile = profileCoValue();
    if (profile && !profile.$isLoaded && profile.$jazz?.ensureLoaded) {
      ensureLoaded(profile).catch((e) => console.warn("Error loading profile:", e));
    }
  });

  // Get root reference
  const rootRef = $derived(() => {
    if (!group || !group.$isLoaded) return null;
    try {
      const groupAny = group as any;
      if (groupAny.root !== undefined && groupAny.root !== null) {
        return groupAny.root;
      }
      if (group.$jazz && typeof group.$jazz.get === "function") {
        try {
          const root = group.$jazz.get("root");
          if (root !== undefined && root !== null) {
            return root;
          }
        } catch (e) {
          // Ignore
        }
      }
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

    <Card>
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-slate-700">Members</h3>
        {#if accountMembers().length > 0}
          <div class="space-y-2">
            {#each accountMembers() as member}
              <div class="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                <span class="text-sm font-mono text-slate-700">
                  {member.id === "everyone" ? "everyone" : formatCoValueId(member.id, 16)}
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

    {#if parentGroups().length > 0}
      <Card>
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-700">Parent Groups</h3>
          <div class="space-y-4">
            {#each parentGroups() as parentGroup}
              <div class="space-y-2">
                <div class="flex items-center justify-between p-2 bg-slate-100 rounded-lg">
                  <span class="text-sm font-mono text-slate-700 font-semibold"
                    >{formatCoValueId(parentGroup.$jazz?.id || "unknown", 16)}</span
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
                            {member.id === "everyone" ? "everyone" : formatCoValueId(member.id, 16)}
                          </span>
                          <Badge type={member.role.toLowerCase()} variant="role">{member.role}</Badge>
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

    {#if childGroups().length > 0}
      <Card>
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-700">Child Groups</h3>
          <div class="space-y-4">
            {#each childGroups() as childGroup}
              <div class="space-y-2">
                <div class="flex items-center justify-between p-2 bg-slate-100 rounded-lg">
                  <span class="text-sm font-mono text-slate-700 font-semibold"
                    >{formatCoValueId(childGroup.$jazz?.id || "unknown", 16)}</span
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
                            {member.id === "everyone" ? "everyone" : formatCoValueId(member.id, 16)}
                          </span>
                          <Badge type={member.role.toLowerCase()} variant="role">{member.role}</Badge>
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
                  <PropertyItem propKey="Name" propValue={profile.name || "Not set"} {coValue} />
                {/if}
                {#if profile.$jazz.has("email")}
                  <PropertyItem propKey="Email" propValue={profile.email || "Not set"} {coValue} />
                {/if}
                {#if profile.$jazz.has("avatar")}
                  <PropertyItem propKey="Has Avatar" propValue="Yes" {coValue} />
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
                propValue={profileId.length > 16 ? formatCoValueId(profileId, 16) : profileId}
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
                  ? formatCoValueId(profileRef()!.$jazz.id, 16)
                  : "unknown"}
                showCopyButton={!!profileRef()?.$jazz?.id}
                copyValue={profileRef()?.$jazz?.id}
              />
              <p class="text-xs text-slate-400 italic">Profile reference found (not a CoValue object)</p>
            </div>
          {/if}
        </div>
      </Card>
    {/if}

    {#if rootRef()}
      <Card>
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-700">References</h3>
          <PropertyItem
            propKey="Root"
            propValue={typeof rootRef() === "string" ? formatCoValueId(rootRef() as string, 16) : "none"}
          />
        </div>
      </Card>
    {/if}

    {#if readKeyId() || currentReadKeyId()}
      <Card>
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-slate-700">Keys</h3>
          {#if readKeyId()}
            <PropertyItem
              propKey="Read Key ID"
              propValue={formatCoValueId(readKeyId() || "none", 16)}
            />
          {/if}
          {#if currentReadKeyId()}
            <PropertyItem
              propKey="Current Read Key ID"
              propValue={formatCoValueId(currentReadKeyId() || "none", 16)}
            />
          {/if}
        </div>
      </Card>
    {/if}

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

