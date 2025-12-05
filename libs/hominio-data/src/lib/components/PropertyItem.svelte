<script lang="ts">
  import { Image } from "jazz-tools/svelte";
  import Badge from "./Badge.svelte";
  import { HOVERABLE_STYLE } from "$lib/utils/styles";

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
    showCopyButton?: boolean; // Show copy button for string values
    copyValue?: string; // Value to copy (if different from displayValue)
    hideBadge?: boolean; // Hide the type badge
    hideValue?: boolean; // Hide the value text (only show badge)
    variant?: "default" | "members"; // Display variant
    membersData?: MembersData; // For members variant
  }

  let {
    propKey,
    propValue,
    onSelect,
    showCopyButton = false,
    copyValue,
    hideBadge = false,
    hideValue = false,
    variant = "default",
    membersData,
  }: Props = $props();

  // Copy button state
  let copied = $state(false);

  // Known CoValue type names that should use their own badge style
  const knownCoValueTypes = ["Image", "FileStream", "CoMap", "CoList", "CoValue"];

  // Extract display value and type
  const displayInfo = $derived(() => {
    // Handle primitive values
    if (typeof propValue !== "object" || propValue === null) {
      const stringValue = String(propValue || "");
      // Check if the string value is a known CoValue type name
      const isKnownType = knownCoValueTypes.includes(stringValue);
      return {
        displayValue: stringValue,
        type: isKnownType ? stringValue : typeof propValue,
        isCoValue: false,
        coValue: null,
        showImagePreview: false,
      };
    }

    // Handle arrays (before checking for type property)
    if (Array.isArray(propValue)) {
      // Display array items individually, joined with commas
      const arrayDisplay = propValue.map((item) => String(item)).join(", ");
      return {
        displayValue: arrayDisplay,
        type: "array",
        isCoValue: false,
        coValue: null,
        showImagePreview: false,
        isArray: true,
        arrayItems: propValue,
      };
    }

    // Handle plain objects (not CoValues) - check if it has $jazz property
    if (!("$jazz" in propValue) && !("type" in propValue)) {
      try {
        // Check if it's a plain object (not a CoValue)
        const keys = Object.keys(propValue).filter((k) => !k.startsWith("$"));
        if (keys.length > 0) {
          return {
            displayValue: JSON.stringify(propValue, null, 2),
            type: "object",
            isCoValue: false,
            coValue: null,
            showImagePreview: false,
          };
        }
      } catch (e) {
        // Fall through to default handling
      }
    }

    // Handle extracted property objects with type
    if ("type" in propValue) {
      if (propValue.type === "ImageDefinition") {
        // ImageDefinition: Show preview
        const imageId = (() => {
          try {
            if (propValue.coValue?.$jazz?.id) {
              return propValue.coValue.$jazz.id;
            }
            if (propValue.imageDefinition?.$jazz?.id) {
              return propValue.imageDefinition.$jazz.id;
            }
            if (propValue.rawValue?.$jazz?.id) {
              return propValue.rawValue.$jazz.id;
            }
          } catch (e) {
            // Ignore errors
          }
          return propValue.id || "unknown";
        })();
        const isImageLoaded = (() => {
          try {
            if (propValue.coValue?.$isLoaded) return true;
            if (propValue.imageDefinition?.$isLoaded) return true;
            if (propValue.rawValue?.$isLoaded) return true;
          } catch (e) {
            // Ignore errors
          }
          return propValue.isLoaded || false;
        })();

        return {
          displayValue: imageId,
          type: "Image",
          isCoValue: true,
          coValue: propValue.coValue || propValue.imageDefinition || propValue.rawValue,
          showImagePreview: isImageLoaded && imageId !== "unknown",
          imageId,
        };
      } else if (propValue.type === "FileStream") {
        return {
          displayValue: propValue.id || "unknown",
          type: "FileStream",
          isCoValue: true,
          coValue: propValue.coValue || propValue.fileStream,
          showImagePreview: false,
        };
      } else if (propValue.type === "CoMap") {
        return {
          displayValue: propValue.id || "unknown",
          type: "CoMap",
          isCoValue: true,
          coValue: propValue.coValue,
          showImagePreview: false,
        };
      } else if (propValue.type === "CoList") {
        return {
          displayValue: `${propValue.length || 0} items`,
          type: "CoList",
          isCoValue: true,
          coValue: propValue.coValue,
          showImagePreview: false,
        };
      } else if (propValue.type === "CoValue") {
        return {
          displayValue: propValue.id || "unknown",
          type: "CoValue",
          isCoValue: true,
          coValue: propValue.coValue,
          showImagePreview: false,
        };
      } else {
        // Other types
        return {
          displayValue: String(propValue),
          type: propValue.type || "unknown",
          isCoValue: false,
          coValue: null,
          showImagePreview: false,
        };
      }
    }

    // Fallback for raw values
    return {
      displayValue: String(propValue),
      type: typeof propValue,
      isCoValue: false,
      coValue: null,
      showImagePreview: false,
    };
  });

  // Check if this property is clickable (has a CoValue that can be navigated to)
  const isClickable = $derived(
    variant !== "members" &&
      displayInfo().isCoValue &&
      displayInfo().coValue &&
      onSelect !== undefined,
  );
</script>

{#if isClickable}
  <!-- Clickable PropertyItem: Whole card is clickable -->
  <button
    type="button"
    onclick={() => {
      if (displayInfo().coValue && onSelect) {
        onSelect(displayInfo().coValue, propKey);
      }
    }}
    class="w-full text-left bg-slate-100 rounded-2xl p-3 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm {HOVERABLE_STYLE}"
  >
    <!-- Default Variant (clickable props are never members variant) -->
    <div class="flex justify-between items-center gap-2">
      <!-- Left: Prop Key -->
      <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {propKey}
      </span>

      <!-- Right: Value and Type Badge -->
      <div class="flex items-center gap-2 flex-1 justify-end min-w-0">
        {#if displayInfo().showImagePreview && displayInfo().imageId}
          <!-- ImageDefinition: Show preview -->
          {#if displayInfo().coValue && onSelect}
            <div class="inline-flex items-center gap-2">
              <div class="w-8 h-8 rounded overflow-hidden border border-slate-300 shrink-0">
                <Image
                  imageId={displayInfo().imageId}
                  width={32}
                  height={32}
                  alt={propKey}
                  class="object-cover w-full h-full"
                  loading="lazy"
                />
              </div>
              <span class="text-xs text-slate-600 font-mono break-all"
                >{displayInfo().displayValue.slice(0, 8)}...</span
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
          {:else}
            <div class="inline-flex items-center gap-2">
              <div class="w-8 h-8 rounded overflow-hidden border border-slate-300 shrink-0">
                <Image
                  imageId={displayInfo().imageId}
                  width={32}
                  height={32}
                  alt={propKey}
                  class="object-cover w-full h-full"
                  loading="lazy"
                />
              </div>
              <span class="text-xs text-slate-600 font-mono break-all"
                >{displayInfo().displayValue.slice(0, 8)}...</span
              >
            </div>
          {/if}
        {:else if displayInfo().isCoValue && displayInfo().coValue && onSelect}
          <!-- CoValue: Show ID (card is already clickable) -->
          <div class="inline-flex items-center gap-2 text-left">
            <span class="text-xs text-slate-600 font-mono break-all"
              >{displayInfo().displayValue.slice(0, 12)}...</span
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
        {:else}
          <!-- Primitive or non-navigable value: Allow wrapping for long strings -->
          {#if !hideValue}
            {#if displayInfo().type === "object"}
              <!-- Object: Use monospace font and preserve formatting -->
              <pre
                class="text-xs text-slate-600 break-all break-words whitespace-pre-wrap word-break break-word font-mono bg-slate-50/50 p-2 rounded border border-slate-200 max-w-full overflow-x-auto"
                style="word-break: break-all; overflow-wrap: anywhere;">
              {displayInfo().displayValue}
            </pre>
            {:else if displayInfo().type === "array" && displayInfo().arrayItems}
              <!-- Array: Display items individually without brackets -->
              {@const arrayItems = displayInfo().arrayItems!}
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
              <!-- Primitive values: Regular text with wrapping -->
              {@const isIdLike =
                typeof displayInfo().displayValue === "string" &&
                displayInfo().displayValue.startsWith("co_")}
              <span
                class="text-xs text-slate-600 break-all break-words whitespace-pre-wrap word-break break-word {isIdLike
                  ? 'font-mono'
                  : ''}"
                style="word-break: break-all; overflow-wrap: anywhere;"
              >
                {displayInfo().displayValue}
              </span>
            {/if}
          {/if}
        {/if}

        <!-- Copy Button (if enabled and value is string) -->
        {#if showCopyButton && typeof displayInfo().displayValue === "string"}
          <button
            type="button"
            onclick={(e) => {
              e.stopPropagation();
              (async () => {
                try {
                  const valueToCopy = copyValue || displayInfo().displayValue;
                  await navigator.clipboard.writeText(valueToCopy);
                  copied = true;
                  setTimeout(() => {
                    copied = false;
                  }, 2000);
                } catch (err) {
                  console.error("Failed to copy:", err);
                }
              })();
            }}
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

        <!-- Type Badge (right-aligned) -->
        {#if !hideBadge}
          <Badge type={displayInfo().type}>{displayInfo().type}</Badge>
        {/if}
      </div>
    </div>
  </button>
{:else}
  <!-- Non-clickable PropertyItem: Regular div -->
  <div
    class="bg-slate-100 rounded-2xl {variant === 'members'
      ? 'p-4'
      : 'p-3'} border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm"
  >
    {#if variant === "members" && membersData}
      <!-- Members Variant -->
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">{propKey}</span>
        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>

      <!-- Accounts -->
      {#if membersData.accountMembers.length > 0}
        <div class="mb-3 space-y-1.5 mt-2">
          <span class="text-[10px] font-medium text-slate-500 uppercase tracking-wide"
            >ACCOUNTS</span
          >
          {#each membersData.accountMembers as member}
            <div class="flex items-center justify-between p-1.5 rounded-lg">
              <span class="font-mono text-xs text-slate-600">{member.id.slice(0, 8)}...</span>
              <Badge type={member.role.toLowerCase()} variant="role">{member.role}</Badge>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Groups -->
      {#if membersData.groupMembers.length > 0}
        <div class="pt-3 border-t border-white/50 space-y-1.5 mt-2">
          <span class="text-[10px] font-medium text-slate-500 uppercase tracking-wide">GROUPS</span>
          {#each membersData.groupMembers as groupMember}
            <div class="flex items-center justify-between p-1.5 rounded-lg">
              <span class="font-mono text-xs text-slate-600">{groupMember.id.slice(0, 8)}...</span>
              <div class="flex items-center gap-2">
                <Badge type={groupMember.role.toLowerCase()} variant="role"
                  >{groupMember.role}</Badge
                >
                {#if membersData.onRemoveGroupMember}
                  <button
                    type="button"
                    class="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors shrink-0"
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
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <!-- Default Variant -->
      <div class="flex justify-between items-center gap-2">
        <!-- Left: Prop Key -->
        <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {propKey}
        </span>

        <!-- Right: Value and Type Badge -->
        <div class="flex items-center gap-2 flex-1 justify-end min-w-0">
          {#if displayInfo().showImagePreview && displayInfo().imageId}
            <!-- ImageDefinition: Show preview -->
            <div class="inline-flex items-center gap-2">
              <div class="w-8 h-8 rounded overflow-hidden border border-slate-300 shrink-0">
                <Image
                  imageId={displayInfo().imageId}
                  width={32}
                  height={32}
                  alt={propKey}
                  class="object-cover w-full h-full"
                  loading="lazy"
                />
              </div>
              <span class="text-xs text-slate-600 font-mono break-all"
                >{displayInfo().displayValue.slice(0, 8)}...</span
              >
            </div>
          {:else if displayInfo().isCoValue && displayInfo().coValue && onSelect}
            <!-- CoValue: Show ID -->
            <div class="inline-flex items-center gap-2 text-left">
              <span class="text-xs text-slate-600 font-mono break-all"
                >{displayInfo().displayValue.slice(0, 12)}...</span
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
          {:else}
            <!-- Primitive or non-navigable value: Allow wrapping for long strings -->
            {#if !hideValue}
              {#if displayInfo().type === "object"}
                <!-- Object: Use monospace font and preserve formatting -->
                <pre
                  class="text-xs text-slate-600 break-all break-words whitespace-pre-wrap word-break break-word font-mono bg-slate-50/50 p-2 rounded border border-slate-200 max-w-full overflow-x-auto"
                  style="word-break: break-all; overflow-wrap: anywhere;">
                  {displayInfo().displayValue}
                </pre>
              {:else if displayInfo().type === "array" && displayInfo().arrayItems}
                <!-- Array: Display items individually without brackets -->
                {@const arrayItems = displayInfo().arrayItems!}
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
                <!-- Primitive values: Regular text with wrapping -->
                {@const isIdLike =
                  typeof displayInfo().displayValue === "string" &&
                  displayInfo().displayValue.startsWith("co_")}
                <span
                  class="text-xs text-slate-600 break-all break-words whitespace-pre-wrap word-break break-word {isIdLike
                    ? 'font-mono'
                    : ''}"
                  style="word-break: break-all; overflow-wrap: anywhere;"
                >
                  {displayInfo().displayValue}
                </span>
              {/if}
            {/if}
          {/if}

          <!-- Copy Button (if enabled and value is string) -->
          {#if showCopyButton && typeof displayInfo().displayValue === "string"}
            <button
              type="button"
              onclick={async () => {
                try {
                  const valueToCopy = copyValue || displayInfo().displayValue;
                  await navigator.clipboard.writeText(valueToCopy);
                  copied = true;
                  setTimeout(() => {
                    copied = false;
                  }, 2000);
                } catch (e) {
                  console.error("Failed to copy:", e);
                }
              }}
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

          <!-- Type Badge (right-aligned) -->
          {#if !hideBadge}
            <Badge type={displayInfo().type}>{displayInfo().type}</Badge>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}
