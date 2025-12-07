<script lang="ts">
  import Card from "../leafs/Card.svelte";
  import Button from "../leafs/Button.svelte";

  interface Props {
    // Left title
    leftTitle: string;
    leftIconType?: "root" | "colist" | "group" | "covalue"; // Icon type
    // Right title (optional, for aside)
    rightTitle?: string;
    showRightIcon?: boolean; // Show info icon for metadata
    // Back button
    showBack?: boolean;
    onBack?: () => void;
    // Content snippets (Svelte 5 named snippets)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    main?: any; // Main content snippet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    aside?: any; // Optional aside content snippet
    // Workaround for TypeScript - Svelte 5 snippets may be passed as children
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }

  let {
    leftTitle,
    leftIconType,
    rightTitle,
    showRightIcon = false,
    showBack = false,
    onBack,
    main,
    aside,
  }: Props = $props();
</script>

<!-- Title Row: Always visible, aligned -->
<div class="flex items-center justify-between mb-6 px-6">
  <div class="flex-1">
    <h2 class="text-lg font-semibold text-slate-700 flex items-center gap-2 m-0">
      {#if leftIconType === "root"}
        <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      {:else if leftIconType === "colist"}
        <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      {:else if leftIconType === "group"}
        <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      {:else if leftIconType === "covalue"}
        <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
      {/if}
      <span>{leftTitle}</span>
      {#if showBack && onBack}
        <div class="ml-auto mr-4">
          <Button variant="ghost" size="sm" onclick={onBack}>
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span>Back</span>
          </Button>
        </div>
      {/if}
    </h2>
  </div>
  {#if rightTitle}
    <div class="w-80 shrink-0">
      <h2 class="text-lg font-semibold text-slate-700 flex items-center justify-end gap-2 m-0">
        <span>{rightTitle}</span>
        {#if showRightIcon}
          <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        {/if}
      </h2>
    </div>
  {/if}
</div>

<!-- Two-column layout: Main + Aside -->
<div class="flex gap-6 items-start">
  <!-- Main Content -->
  {#if main}
    <div class="flex-1 min-w-0 space-y-6">
      <Card>
        {@render main()}
      </Card>
    </div>
  {/if}

  <!-- Right Aside: Metadata (if provided) -->
  {#if aside}
    <div class="w-80 shrink-0">
      <aside class="sticky top-6">
        <Card>
          {@render aside()}
        </Card>
      </aside>
    </div>
  {/if}
</div>
