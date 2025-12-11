<script lang="ts">
  import { JazzAccount, migrateAddCars, addRandomCarInstance, resetData } from "@hominio/data";
  import { AccountCoState } from "jazz-tools/svelte";

  // Load account with schemata
  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        schemata: true,
      },
    },
  });

  const me = $derived(account.current);

  // Handle manual migration trigger
  async function handleAddCars() {
    if (!me.$isLoaded) return;

    try {
      await migrateAddCars(me);

      // Reload root to ensure data field is visible
      if (me.root?.$isLoaded) {
        await me.root.$jazz.ensureLoaded({
          resolve: { data: true },
        });
      }

      alert("Cars list added successfully! Refresh the data explorer to see it.");
    } catch (error) {
      console.error("Error adding Cars:", error);
      alert("Error adding Cars. Check console for details.");
    }
  }

  // Handle adding random car instance
  async function handleAddRandomCar() {
    if (!me.$isLoaded) return;

    try {
      await addRandomCarInstance(me);

      // Reload root to ensure data field is visible
      if (me.root?.$isLoaded) {
        await me.root.$jazz.ensureLoaded({
          resolve: { data: true },
        });
      }

      alert("Random car instance added successfully! Refresh the data explorer to see it.");
    } catch (error) {
      console.error("Error adding random car:", error);
      alert("Error adding random car. Check console for details.");
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
  <!-- Main area: Schemata list -->
  <main class="flex-1 p-4 bg-gray-50">
    <h2 class="font-bold mb-4 text-lg">Schemata</h2>

    <div class="mb-4 flex gap-2">
      <button
        onclick={() => handleAddCars()}
        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        Add Cars
      </button>
      <button
        onclick={() => handleAddRandomCar()}
        class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
      >
        Add Random Car
      </button>
      <button
        onclick={() => handleResetData()}
        class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
      >
        Reset Data
      </button>
    </div>

    {#if me.$isLoaded && me.root?.schemata?.$isLoaded}
      {@const schemataArray = Array.from(me.root.schemata)}
      <div class="space-y-2">
        {#each schemataArray as schema}
          {@const schemaLoaded = schema.$isLoaded ? schema : null}
          {#if schemaLoaded}
            <div class="p-3 border rounded-lg bg-white shadow-sm">
              <div class="font-medium text-sm">{schemaLoaded.name}</div>
              <pre class="text-xs bg-slate-50 p-2 rounded border mt-2 overflow-x-auto">
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
      <p class="text-sm text-slate-400">Loading schemata...</p>
    {/if}
  </main>
</div>
