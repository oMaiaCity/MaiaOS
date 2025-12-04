<script lang="ts">
  import { JazzAccount } from "$lib/schema";
  import { AccountCoState } from "jazz-tools/svelte";

  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        humans: true,
      },
    },
  });
  const me = $derived(account.current);

  const firstHuman = $derived(
    me.$isLoaded && me.root?.humans?.$isLoaded && me.root.humans.length > 0
      ? me.root.humans[0]
      : null,
  );

  // Get avatar values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const avatar = $derived(
    firstHuman?.$isLoaded && firstHuman.$jazz.has("avatar") ? (firstHuman.avatar as any) : null,
  );

  const firstName = $derived(avatar?.firstName?.trim() || "");
  const lastName = $derived(avatar?.lastName?.trim() || "");

  function handleFirstNameChange(event: Event & { currentTarget: HTMLInputElement }) {
    if (
      firstHuman?.$isLoaded &&
      firstHuman.$jazz.has("avatar") &&
      event.currentTarget.value !== undefined
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentAvatar = firstHuman.avatar as any;
      firstHuman.$jazz.set("avatar", {
        firstName: event.currentTarget.value,
        lastName: currentAvatar?.lastName || "",
        image: currentAvatar?.image || "",
      });
    }
  }

  function handleLastNameChange(event: Event & { currentTarget: HTMLInputElement }) {
    if (
      firstHuman?.$isLoaded &&
      firstHuman.$jazz.has("avatar") &&
      event.currentTarget.value !== undefined
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentAvatar = firstHuman.avatar as any;
      firstHuman.$jazz.set("avatar", {
        firstName: currentAvatar?.firstName || "",
        lastName: event.currentTarget.value,
        image: currentAvatar?.image || "",
      });
    }
  }
</script>

{#if firstHuman?.$isLoaded && firstHuman.$jazz.has("avatar")}
  <div class="grid gap-4 border p-8 border-stone-200">
    <div class="flex items-center gap-3">
      <label for="firstName" class="sm:w-32"> First Name </label>
      <input
        type="text"
        id="firstName"
        class="bg-gray-100 border border-slate-300 rounded-full shadow-xs py-1 px-2 flex-1"
        value={firstName}
        oninput={handleFirstNameChange}
      />
    </div>
    <div class="flex items-center gap-3">
      <label for="lastName" class="sm:w-32"> Last Name </label>
      <input
        type="text"
        id="lastName"
        class="bg-gray-100 border border-slate-300 rounded-full shadow-xs py-1 px-2 flex-1"
        value={lastName}
        oninput={handleLastNameChange}
      />
    </div>
  </div>
{/if}
