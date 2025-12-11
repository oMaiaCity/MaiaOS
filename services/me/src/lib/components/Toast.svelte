<script lang="ts">
  import { toast } from "../stores/toast.js";
  import type { Toast } from "../stores/toast.js";

  let toasts: Toast[] = [];

  toast.subscribe((value) => {
    toasts = value;
  });

  function getToastStyles(type: Toast["type"]) {
    switch (type) {
      case "success":
        return "bg-green-500 text-white border-green-600";
      case "error":
        return "bg-red-500 text-white border-red-600";
      case "warning":
        return "bg-yellow-500 text-white border-yellow-600";
      case "info":
      default:
        return "bg-blue-500 text-white border-blue-600";
    }
  }
</script>

<div class="fixed top-20 right-4 z-[9999] flex flex-col gap-2 max-w-md">
  {#each toasts as toastItem (toastItem.id)}
    <div
      class="px-4 py-3 rounded-lg shadow-lg border animate-in fade-in slide-in-from-right duration-300 {getToastStyles(
        toastItem.type,
      )}"
      role="alert"
    >
      <div class="flex items-center justify-between gap-4">
        <p class="text-sm font-medium">{toastItem.message}</p>
        <button
          onclick={() => toast.remove(toastItem.id)}
          class="text-white/80 hover:text-white transition-colors shrink-0"
          aria-label="Close"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  {/each}
</div>

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .animate-in {
    animation: fade-in 0.3s ease-out;
  }
</style>

