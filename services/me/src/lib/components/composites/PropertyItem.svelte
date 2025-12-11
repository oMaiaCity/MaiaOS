<script lang="ts">
  import { Image } from "jazz-tools/svelte";
  import Badge from "../leafs/Badge.svelte";
  import PropertyValue from "../leafs/PropertyValue.svelte";
  import { getDisplayValue } from "../../utilities/propertyUtilities.js";
  import { resolveProfile, isComputedField } from "@hominio/data";

  interface Member {
    id: string;
    role: string;
  }

  interface MembersData {
    accountMembers: Member[];
    groupMembers: Member[];
    onRemoveGroupMember?: (groupId: string) => void;
  }

  interface Props {
    propKey: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    propValue: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSelect?: (coValue: any, fallbackKey?: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onObjectSelect?: (object: any, label: string, parentCoValue: any, parentKey: string) => void;
    showCopyButton?: boolean;
    copyValue?: string;
    hideBadge?: boolean;
    hideValue?: boolean;
    variant?: "default" | "members";
    membersData?: MembersData;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentAccount?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    coValue?: any;
    // Force a specific badge type (overrides getDisplayValue type detection)
    badgeType?: string;
  }

  let {
    propKey,
    propValue,
    onSelect,
    onObjectSelect,
    showCopyButton = false,
    copyValue,
    hideBadge = false,
    hideValue = false,
    variant = "default",
    membersData,
    currentAccount,
    coValue,
    badgeType,
  }: Props = $props();

  let copied = $state(false);

  const isComputed = $derived.by(() => {
    if (!coValue || !propKey) return false;
    try {
      return isComputedField(coValue, propKey);
    } catch (e) {
      return false;
    }
  });

  const sortedAccountMembers = $derived(() => {
    if (!membersData?.accountMembers) return [];
    const members = [...membersData.accountMembers];
    return members.sort((a, b) => {
      if (a.id === "everyone") return -1;
      if (b.id === "everyone") return 1;
      return 0;
    });
  });

  const displayInfo = $derived(getDisplayValue(propValue));
  const isLoading = $derived(propValue?.isLoading === true);
  const isClickable = $derived(
    variant !== "members" &&
      ((displayInfo.isCoValue && displayInfo.coValue && onSelect !== undefined) ||
        (displayInfo.type === "object" &&
          typeof propValue === "object" &&
          propValue !== null &&
          !("$jazz" in propValue) &&
          !("type" in propValue) &&
          onObjectSelect !== undefined &&
          coValue !== undefined)),
  );

  async function handleCopy() {
    try {
      const valueToCopy = copyValue || displayInfo.displayValue;
      await navigator.clipboard.writeText(valueToCopy);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }
</script>

{#if isClickable}
  <!-- Clickable PropertyItem -->
  <button
    type="button"
    onclick={() => {
      if (
        displayInfo.type === "object" &&
        typeof propValue === "object" &&
        propValue !== null &&
        !("$jazz" in propValue) &&
        onObjectSelect &&
        coValue
      ) {
        // Handle object navigation - propValue is the plain object itself
        onObjectSelect(propValue, propKey, coValue, propKey);
      } else if (displayInfo.coValue && onSelect) {
        // Handle CoValue navigation
        onSelect(displayInfo.coValue, propKey);
      }
    }}
    class="w-full text-left bg-slate-100 rounded-2xl p-3 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm hoverable"
  >
    <div class="flex justify-between items-center gap-2">
      <div class="flex items-center gap-1.5">
        <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">{propKey}</span>
        {#if isComputed}
          <Badge type="computed">computed</Badge>
        {/if}
      </div>

      <div class="flex items-center gap-2 flex-1 justify-end min-w-0">
        {#if isLoading}
          <div class="inline-flex items-center gap-1.5">
            <div class="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            <Badge type="loading">Loading...</Badge>
          </div>
        {:else if displayInfo.showImagePreview && displayInfo.imageId}
          <div class="inline-flex items-center gap-2">
            <div class="w-8 h-8 rounded overflow-hidden border border-slate-300 shrink-0">
              <Image
                imageId={displayInfo.imageId}
                width={32}
                height={32}
                alt={propKey}
                class="object-cover w-full h-full"
                loading="lazy"
              />
            </div>
            <span class="text-xs text-slate-600 font-mono break-all"
              >{displayInfo.displayValue.slice(0, 8)}...</span
            >
            <svg
              class="w-3 h-3 text-slate-400 shrink-0"
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
          </div>
        {:else if displayInfo.isCoValue && displayInfo.coValue && onSelect}
          <div class="inline-flex items-center gap-2 text-left">
            <span class="text-xs text-slate-600 font-mono break-all"
              >{displayInfo.displayValue.slice(0, 12)}...</span
            >
            <svg
              class="w-3 h-3 text-slate-400 shrink-0"
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
          </div>
        {:else if displayInfo.type === "object" && typeof propValue === "object" && propValue !== null && !("$jazz" in propValue) && onObjectSelect && coValue}
          <div class="inline-flex items-center gap-2 text-left">
            <span class="text-xs text-slate-600 font-mono break-all">Object</span>
            <span class="text-xs text-slate-500">({Object.keys(propValue || {}).length} keys)</span>
            <svg
              class="w-3 h-3 text-slate-400 shrink-0"
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
          </div>
        {:else if !hideValue}
          {#if displayInfo.type === "object"}
            <pre
              class="text-xs text-slate-600 whitespace-pre font-mono bg-slate-50/50 p-2 rounded border border-slate-200 max-w-full overflow-x-auto overflow-y-auto"
              style="max-height: 400px;">{displayInfo.displayValue}</pre>
          {:else if displayInfo.type === "array" && displayInfo.arrayItems}
            {@const arrayItems = displayInfo.arrayItems!}
            <div class="flex flex-wrap items-center gap-1">
              {#each arrayItems as item, index}
                <span
                  class="text-xs text-slate-600 bg-slate-50/50 px-2 py-0.5 rounded border border-slate-200"
                >
                  {String(item)}
                </span>
                {#if index < arrayItems.length - 1}
                  <span class="text-slate-400">,</span>
                {/if}
              {/each}
            </div>
          {:else}
            {@const isIdLike =
              typeof displayInfo.displayValue === "string" &&
              displayInfo.displayValue.startsWith("co_")}
            {@const isAlreadyTruncated =
              typeof displayInfo.displayValue === "string" &&
              displayInfo.displayValue.endsWith("...")}
            <span
              class="text-xs text-slate-600 {isIdLike ? 'font-mono' : ''} {isAlreadyTruncated
                ? 'truncate'
                : 'break-all'}"
              style={isAlreadyTruncated ? "" : "word-break: break-all; overflow-wrap: anywhere;"}
            >
              {displayInfo.displayValue}
            </span>
          {/if}
        {/if}

        {#if showCopyButton && typeof displayInfo.displayValue === "string"}
          <div
            role="button"
            tabindex="0"
            onclick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                handleCopy();
              }
            }}
            class="shrink-0 p-1 hover:bg-slate-300/50 rounded transition-colors relative cursor-pointer"
            aria-label="Copy value"
          >
            {#if copied}
              <svg
                class="w-4 h-4 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            {:else}
              <svg
                class="w-4 h-4 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            {/if}
          </div>
        {/if}

        {#if !hideBadge}
          <Badge type={badgeType || displayInfo.type}>{badgeType || displayInfo.type}</Badge>
        {/if}
      </div>
    </div>
  </button>
{:else}
  <!-- Non-clickable PropertyItem -->
  <div
    class="bg-slate-100 rounded-2xl {variant === 'members'
      ? 'p-4'
      : 'p-3'} border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
  >
    {#if variant === "members" && membersData}
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-medium text-slate-500 uppercase tracking-wide"
          >{propKey === "MEMBERS" ? "Capabilities" : propKey}</span
        >
        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </div>

      {#if membersData.accountMembers.length > 0}
        <div class="mb-3 space-y-1.5 mt-2">
          {#each sortedAccountMembers() as member}
            {@const profileInfo = resolveProfile(member.id, currentAccount)}
            {@const isEveryoneReader =
              member.id === "everyone" && member.role.toLowerCase() === "reader"}
            {@const isAdmin = member.role.toLowerCase() === "admin"}
            <div
              class="flex items-center justify-between p-1.5 rounded-2xl border {isEveryoneReader
                ? 'border-red-300 bg-red-50/50'
                : isAdmin
                  ? 'border-yellow-200 bg-yellow-50/50'
                  : 'border-white'}"
            >
              <div class="flex items-center gap-2 flex-1 min-w-0">
                {#if profileInfo && profileInfo.image}
                  <div
                    class="w-6 h-6 rounded-full overflow-hidden border border-slate-300 shrink-0"
                  >
                    <Image
                      imageId={profileInfo.image.$jazz.id}
                      width={24}
                      height={24}
                      alt={profileInfo.name || member.id}
                      class="object-cover w-full h-full"
                      loading="lazy"
                    />
                  </div>
                {/if}
                <div class="flex flex-col min-w-0 flex-1">
                  {#if profileInfo && profileInfo.name && member.id !== "everyone"}
                    <span
                      class="font-mono text-xs {isAdmin
                        ? 'text-yellow-700'
                        : 'text-slate-700'} truncate">{profileInfo.name}</span
                    >
                  {:else}
                    <span
                      class="font-mono text-xs {isEveryoneReader
                        ? 'text-red-700'
                        : isAdmin
                          ? 'text-yellow-600'
                          : 'text-slate-600'} truncate"
                    >
                      {member.id === "everyone"
                        ? member.id.charAt(0).toUpperCase() + member.id.slice(1)
                        : member.id.slice(0, 8) + "..."}
                    </span>
                  {/if}
                </div>
              </div>
              <Badge type={member.role.toLowerCase()} variant="role">{member.role}</Badge>
            </div>
          {/each}
        </div>
      {/if}

      {#if membersData.groupMembers.length > 0}
        <div class="space-y-1.5 mt-1">
          <span class="text-[10px] font-medium text-slate-500 uppercase tracking-wide">GROUPS</span>
          {#each membersData.groupMembers as groupMember}
            <div class="flex items-center gap-2">
              <div
                class="flex items-center justify-between flex-1 p-1.5 rounded-2xl border border-white"
              >
                <span class="font-mono text-xs text-slate-600">{groupMember.id.slice(0, 8)}...</span
                >
                <Badge type={groupMember.role.toLowerCase()} variant="role"
                  >{groupMember.role}</Badge
                >
              </div>
              {#if membersData.onRemoveGroupMember}
                <button
                  type="button"
                  class="p-1 text-red-600 hover:text-red-700 bg-red-100 border border-red-300 rounded-full transition-colors shrink-0"
                  onclick={() => membersData!.onRemoveGroupMember!(groupMember.id)}
                  title="Remove parent group"
                  aria-label="Remove parent group"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <!-- Default Variant -->
      <div class="flex justify-between items-center gap-2">
        <div class="flex items-center gap-1.5">
          <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">{propKey}</span>
          {#if isComputed}
            <Badge type="computed">computed</Badge>
          {/if}
        </div>

        <div class="flex items-center gap-2 flex-1 justify-end min-w-0">
          {#if displayInfo.showImagePreview && displayInfo.imageId}
            <div class="inline-flex items-center gap-2">
              <div class="w-8 h-8 rounded overflow-hidden border border-slate-300 shrink-0">
                <Image
                  imageId={displayInfo.imageId}
                  width={32}
                  height={32}
                  alt={propKey}
                  class="object-cover w-full h-full"
                  loading="lazy"
                />
              </div>
              <span class="text-xs text-slate-600 font-mono break-all"
                >{displayInfo.displayValue.slice(0, 8)}...</span
              >
            </div>
          {:else if displayInfo.isCoValue && displayInfo.coValue && onSelect}
            <div class="inline-flex items-center gap-2 text-left">
              <span class="text-xs text-slate-600 font-mono break-all"
                >{displayInfo.displayValue.slice(0, 12)}...</span
              >
              <svg
                class="w-3 h-3 text-slate-400 shrink-0"
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
            </div>
          {:else if !hideValue}
            {#if displayInfo.type === "object"}
              <pre
                class="text-xs text-slate-600 whitespace-pre font-mono bg-slate-50/50 p-2 rounded border border-slate-200 max-w-full overflow-x-auto overflow-y-auto"
                style="max-height: 400px;">{displayInfo.displayValue}</pre>
            {:else if displayInfo.type === "array" && displayInfo.arrayItems}
              {@const arrayItems = displayInfo.arrayItems!}
              <div class="flex flex-wrap items-center gap-1">
                {#each arrayItems as item, index}
                  <span
                    class="text-xs text-slate-600 bg-slate-50/50 px-2 py-0.5 rounded border border-slate-200"
                  >
                    {String(item)}
                  </span>
                  {#if index < arrayItems.length - 1}
                    <span class="text-slate-400">,</span>
                  {/if}
                {/each}
              </div>
            {:else}
              {@const isIdLike =
                typeof displayInfo.displayValue === "string" &&
                displayInfo.displayValue.startsWith("co_")}
              {@const isAlreadyTruncated =
                typeof displayInfo.displayValue === "string" &&
                displayInfo.displayValue.endsWith("...")}
              <span
                class="text-xs text-slate-600 {isIdLike ? 'font-mono' : ''} {isAlreadyTruncated
                  ? 'truncate'
                  : 'break-all'}"
                style={isAlreadyTruncated ? "" : "word-break: break-all; overflow-wrap: anywhere;"}
              >
                {displayInfo.displayValue}
              </span>
            {/if}
          {/if}

          {#if showCopyButton && typeof displayInfo.displayValue === "string"}
            <button
              type="button"
              onclick={handleCopy}
              class="shrink-0 p-1 hover:bg-slate-300/50 rounded transition-colors relative"
              aria-label="Copy value"
            >
              {#if copied}
                <svg
                  class="w-4 h-4 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              {:else}
                <svg
                  class="w-4 h-4 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              {/if}
            </button>
          {/if}

          {#if !hideBadge}
            <Badge type={badgeType || displayInfo.type}>{badgeType || displayInfo.type}</Badge>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}
