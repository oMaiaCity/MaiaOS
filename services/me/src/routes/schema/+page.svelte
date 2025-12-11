<script lang="ts">
  import { JazzAccount, addRandomCarInstance, resetData } from "@hominio/data";
  import { AccountCoState } from "jazz-tools/svelte";

  // Load account with data (list of SchemaDefinitions)
  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        data: true,
      },
    },
  });

  const me = $derived(account.current);

  // Handle adding a car (automatically creates schema if needed)
  async function handleAddCar() {
    if (!me.$isLoaded) return;

    try {
      await addRandomCarInstance(me);

      // Reload root to ensure data field is visible
      if (me.root?.$isLoaded) {
        await me.root.$jazz.ensureLoaded({
          resolve: { data: true },
        });
      }

      alert("Car added successfully! Check the data explorer to see it.");
    } catch (error) {
      console.error("Error adding car:", error);
      alert("Error adding car. Check console for details.");
    }
  }

  // Handle reset data
  async function handleResetData() {
    if (!me.$isLoaded) return;

    if (confirm("Are you sure you want to reset/clear the data list? This cannot be undone.")) {
      try {
        await resetData(me);
        alert("Data list reset successfully!");
      } catch (error) {
        console.error("Error resetting data:", error);
        alert("Error resetting data. Check console for details.");
      }
    }
  }
</script>

<div class="flex h-full mt-24">
  <!-- Main area: Schema list -->
  <main class="flex-1 p-4 bg-gray-50">
    <h2 class="font-bold mb-4 text-lg">Schemas</h2>

    <div class="mb-4 flex gap-2">
      <button
        onclick={() => handleAddCar()}
        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        Add Car
      </button>
      <button
        onclick={() => handleResetData()}
        class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
      >
        Reset Data
      </button>
    </div>

    {#if me.$isLoaded && me.root?.data?.$isLoaded}
      {@const dataArray = Array.from(me.root.data)}
      {#if dataArray.length > 0}
        <div class="space-y-2">
          {#each dataArray as schema}
            {@const schemaLoaded = schema.$isLoaded ? schema : null}
            {#if schemaLoaded}
              {@const entitiesCount = schemaLoaded.entities?.$isLoaded
                ? Array.from(schemaLoaded.entities).length
                : 0}
              <div class="p-3 border rounded-lg bg-white shadow-sm">
                <div class="flex items-center justify-between mb-2">
                  <div class="font-medium text-sm">{schemaLoaded.name}</div>
                  <div class="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    {entitiesCount}
                    {entitiesCount === 1 ? "entity" : "entities"}
                  </div>
                </div>
                <pre class="text-xs bg-slate-50 p-2 rounded border overflow-x-auto">
                  {JSON.stringify(schemaLoaded.definition, null, 2)}
                </pre>
              </div>
            {:else}
              <div class="p-3 border rounded-lg bg-slate-50">
                <span class="text-sm text-slate-400">Loading...</span>
              </div>
            {/if}
          {/each}
        </div>
      {:else}
        <div class="p-4 border rounded-lg bg-white shadow-sm text-center">
          <p class="text-sm text-slate-600 mb-2">No schemas yet</p>
          <p class="text-xs text-slate-400">Click "Add Car Schema" to create your first schema</p>
        </div>
      {/if}
    {:else}
      <p class="text-sm text-slate-400">Loading schemas...</p>
    {/if}
  </main>
</div>
