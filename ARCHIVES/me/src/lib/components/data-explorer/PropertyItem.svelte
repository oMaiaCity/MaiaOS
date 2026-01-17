<script lang="ts">
  import Badge from "./Badge.svelte";

  interface Props {
    propKey: string;
    propValue: any;
    showCopyButton?: boolean;
    copyValue?: string;
    hideBadge?: boolean;
    hideValue?: boolean;
    badgeType?: string;
    hoverable?: boolean; // If true, border changes on parent hover
  }

  const {
    propKey,
    propValue,
    showCopyButton = false,
    copyValue,
    hideBadge = false,
    hideValue = false,
    badgeType,
    hoverable = false,
  }: Props = $props();

  async function copyToClipboard() {
    if (!copyValue) return;
    try {
      await navigator.clipboard.writeText(copyValue);
    } catch (_e) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = copyValue;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  }
</script>

<div class="flex justify-between items-center gap-2 bg-slate-100 rounded-2xl p-3 border border-white shadow-[0_0_4px_rgba(0,0,0,0.02)] backdrop-blur-sm {hoverable ? 'group-hover:border-slate-300 transition-colors' : ''}">
  <!-- Left side: Prop Key -->
  <div class="flex items-center gap-1.5 flex-shrink-0 min-w-0">
    <span class="text-xs font-medium text-slate-500 uppercase tracking-wide truncate"
      >{propKey}</span
    >
  </div>

  <!-- Right side: Value, Badge, and Copy Button -->
  <div class="flex items-center gap-2 flex-1 justify-end min-w-0">
    {#if !hideValue}
      <span class="text-xs font-mono text-slate-600 break-all min-w-0">
        {typeof propValue === "string"
          ? propValue
          : typeof propValue === "object" && propValue !== null
            ? JSON.stringify(propValue).slice(0, 50) +
              (JSON.stringify(propValue).length > 50 ? "..." : "")
            : String(propValue)}
      </span>
    {/if}

    {#if !hideBadge}
      <Badge type={badgeType || propValue}>{badgeType || propValue}</Badge>
    {/if}

    {#if showCopyButton && copyValue}
      <button
        type="button"
        onclick={copyToClipboard}
        class="shrink-0 p-1 text-slate-400 hover:text-slate-600 transition-colors"
        title="Copy to clipboard"
      >
        <svg
          class="w-3 h-3"
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
      </button>
    {/if}
  </div>
</div>

