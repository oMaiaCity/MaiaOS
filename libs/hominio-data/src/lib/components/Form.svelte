<script lang="ts">
  import { JazzAccount } from "$lib/schema";
  import { AccountCoState } from "jazz-tools/svelte";

  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        o: {
          humans: true,
        },
      },
    },
  });
  const me = $derived(account.current);

  const firstHuman = $derived(
    me.$isLoaded && 
    me.root.o?.humans?.$isLoaded && 
    me.root.o.humans.length > 0
      ? me.root.o.humans[0]
      : null
  );

  const name = $derived(
    firstHuman?.$isLoaded && firstHuman.$jazz.has("name")
      ? firstHuman.name || ""
      : ""
  );

  function handleNameChange(event: Event & { currentTarget: HTMLInputElement }) {
    if (
      firstHuman?.$isLoaded &&
      event.currentTarget.value !== undefined
    ) {
      firstHuman.$jazz.set("name", event.currentTarget.value);
    }
  }
</script>

{#if firstHuman?.$isLoaded}
  <div class="grid gap-4 border p-8 border-stone-200">
    <div class="flex items-center gap-3">
      <label for="name" class="sm:w-32"> Name </label>
      <input
        type="text"
        id="name"
        class="border border-stone-300 rounded shadow-xs py-1 px-2 flex-1"
        value={name}
        oninput={handleNameChange}
      />
    </div>
  </div>
{/if}
