<script lang="ts">
  type ViewType = 'view-rendered' | 'json' | 'inbox' | 'view-json';

  interface Props {
    activeView: ViewType;
    onSelectView: (view: ViewType) => void;
  }

  const { activeView, onSelectView }: Props = $props();

  const views: { id: ViewType; label: string; icon: string }[] = [
    { id: 'view-rendered', label: 'View Rendered', icon: '🎨' },
    { id: 'json', label: 'JSON', icon: '📋' },
    { id: 'inbox', label: 'Inbox Messages', icon: '📨' },
    { id: 'view-json', label: 'View JSON', icon: '🔍' },
  ];
</script>

<div class="flex flex-col h-full bg-slate-50 border-l border-slate-200">
  <div class="p-4 border-b border-slate-200">
    <h2 class="text-lg font-semibold text-slate-900">Views</h2>
    <p class="text-sm text-slate-500 mt-1">
      Select a view to display
    </p>
  </div>
  
  <div class="flex-1 overflow-y-auto p-2">
    {#each views as view}
      <button
        type="button"
        class="w-full text-left px-4 py-3 mb-1 rounded-lg transition-colors flex items-center gap-3 {activeView === view.id
          ? 'bg-blue-100 text-blue-900 font-medium border border-blue-200'
          : 'text-slate-700 hover:bg-slate-100 border border-transparent'}"
        onclick={() => onSelectView(view.id)}
      >
        <span class="text-xl">{view.icon}</span>
        <span class="text-sm">{view.label}</span>
      </button>
    {/each}
  </div>
</div>
