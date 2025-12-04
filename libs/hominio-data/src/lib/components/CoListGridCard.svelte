<script lang="ts">
  import { Image } from "jazz-tools/svelte";

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
    key: string;
    isSelected: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onClick: () => void;
  }

  let { value, key, isSelected, onClick }: Props = $props();

  // Get preview info from first item if available
  const previewInfo = $derived(() => {
    if (value.items && value.items.length > 0) {
      const firstItem = value.items[0];
      if (firstItem.type === "CoValue" && firstItem.item?.$isLoaded) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item = firstItem.item as any;
        const displayLabel = item.$jazz.has("@label")
          ? item["@label"]
          : item.$jazz.id.slice(0, 8);

        // Try to get avatar image if it's a Human
        let avatarImage = null;
        if (item.$jazz.has("avatar") && item.avatar?.$isLoaded) {
          const avatar = item.avatar;
          if (avatar.$jazz.has("image") && avatar.image?.$isLoaded) {
            avatarImage = avatar.image;
          }
        }

        return {
          label: displayLabel,
          hasMore: value.length > 1,
          avatarImage,
        };
      }
    }
    return null;
  });
</script>

<button
  type="button"
  onclick={onClick}
  class="relative overflow-hidden rounded-3xl backdrop-blur-xl bg-slate-100/90 border-2 transition-all cursor-pointer hover:scale-[1.02] {isSelected
    ? 'border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
    : 'border-white shadow-[0_0_8px_rgba(0,0,0,0.03)] hover:border-slate-300'} p-6 h-full flex flex-col"
>
  <!-- Glossy gradient overlay -->
  <div
    class="absolute inset-0 bg-linear-to-br from-white/60 via-white/20 to-transparent pointer-events-none"
  ></div>

  <div class="relative flex flex-col h-full">
    <!-- Header -->
    <div class="mb-4">
      <h3 class="text-lg font-bold text-slate-700 uppercase tracking-wider">{key}</h3>
    </div>

    <!-- Preview Content -->
    <div class="flex-1 flex flex-col items-center justify-center gap-3">
      {#if previewInfo}
        {#if previewInfo.avatarImage}
          <div
            class="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-200 flex-shrink-0"
          >
            <Image
              imageId={previewInfo.avatarImage.$jazz.id}
              width={64}
              height={64}
              alt="Preview"
              class="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        {/if}
        <div class="text-center">
          <div class="text-xl font-bold text-slate-700 mb-1">{previewInfo.label}</div>
          {#if previewInfo.hasMore}
            <div class="text-xs text-slate-400">+{value.length - 1} more</div>
          {/if}
        </div>
      {:else}
        <div class="text-center">
          <div class="text-sm text-slate-400 italic">Click to view</div>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="mt-4 pt-4 border-t border-white/50">
      <div class="flex items-center justify-between text-xs">
        <span class="text-xs bg-blue-100 px-2 py-0.5 rounded text-blue-700 font-mono">CoList</span>
        <span class="text-xs text-slate-500">
          {value.length} {value.length === 1 ? "item" : "items"}
        </span>
      </div>
    </div>
  </div>
</button>

