<script lang="ts">
  import { JazzAccount } from "$lib/schema";
  import { AccountCoState } from "jazz-tools/svelte";

  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        human: {
          content: {
            avatar: {
              content: true,
            },
          },
        },
      },
    },
  });
  const me = $derived(account.current);

  const name = $derived(
    me.$isLoaded && 
    me.root.human.$isLoaded && 
    me.root.human.content?.$isLoaded &&
    me.root.human.content.avatar?.$isLoaded &&
    me.root.human.content.avatar.content?.$isLoaded &&
    me.root.human.content.avatar.content.$jazz.has("name")
      ? me.root.human.content.avatar.content.name || ""
      : ""
  );

  function handleNameChange(event: Event & { currentTarget: HTMLInputElement }) {
    if (
      me.$isLoaded && 
      me.root.human.$isLoaded && 
      me.root.human.content?.$isLoaded &&
      me.root.human.content.avatar?.$isLoaded &&
      me.root.human.content.avatar.content?.$isLoaded &&
      event.currentTarget.value !== undefined
    ) {
      me.root.human.content.avatar.content.$jazz.set("name", event.currentTarget.value);
    }
  }
</script>

{#if me.$isLoaded && me.root.human.$isLoaded && me.root.human.content?.$isLoaded}
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
