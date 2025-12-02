<script lang="ts">
  import { JazzAccount } from "$lib/schema";
  import { AccountCoState, CoState } from "jazz-tools/svelte";
  import { Group } from "jazz-tools";

  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        human: true,
      },
    },
  });
  const me = $derived(account.current);

  // Get the Group that owns the Human CoValue
  const humanGroup = $derived(
    me.$isLoaded && me.root.human?.$isLoaded
      ? new CoState(Group, (me.root.human.$jazz.owner as Group).$jazz.id)
      : null,
  );

  const humanGroupData = $derived(humanGroup?.current);
</script>

{#if me.$isLoaded}
  <div class="text-center">
    <p class="text-sm text-stone-500 mt-2">
      Account ID: <span class="font-mono">{me.$jazz.id}</span>
    </p>
  </div>

  {#if me.root.human.$isLoaded}
    <section class="mt-8">
      <!-- CoValue with Glassmorphism -->
      <div
        class="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/70 border border-white/20 shadow-xl shadow-stone-900/10 p-6"
      >
        <!-- Subtle gradient overlay -->
        <div
          class="absolute inset-0 bg-gradient-to-br from-white/50 to-stone-100/30 pointer-events-none"
        ></div>

        <div class="relative">
          <!-- Header -->
          <div class="mb-4 pb-3 border-b border-stone-200/50">
            <div class="font-semibold text-lg text-stone-800">
              {me.root.human.$jazz.has("@label") ? me.root.human["@label"] : me.root.human.$jazz.id}
            </div>
            <div class="text-xs text-stone-500 mt-1 font-mono break-all">
              ID: {me.root.human.$jazz.id}
            </div>
          </div>

          <div class="space-y-4">
            <!-- Human Properties -->
            <div
              class="backdrop-blur-md bg-stone-50/60 border border-stone-200/40 rounded-xl p-4 shadow-lg shadow-stone-900/5"
            >
              <div class="text-xs font-semibold text-stone-700 mb-3 uppercase tracking-wide">
                Properties
              </div>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between items-center">
                  <span class="text-stone-600">@schema:</span>
                  {#if me.root.human.$jazz.has("@schema")}
                    <span class="font-semibold text-stone-800">{me.root.human["@schema"]}</span>
                  {:else}
                    <span class="text-stone-400 italic">(not set)</span>
                  {/if}
                </div>
                <div class="flex justify-between items-center pt-2 border-t border-stone-200/50">
                  <label for="human-name" class="text-stone-600">Name:</label>
                  <input
                    type="text"
                    id="human-name"
                    class="border border-stone-300 rounded shadow-xs py-1 px-2 text-sm text-right font-semibold text-stone-800 min-w-[150px]"
                    value={me.root.human.$jazz.has("name") ? me.root.human.name : ""}
                    oninput={(e) => {
                      me.root.human.$jazz.set("name", e.currentTarget.value);
                    }}
                  />
                </div>
              </div>
            </div>

            <!-- Access Control -->
            {#if humanGroupData?.$isLoaded}
              <div
                class="backdrop-blur-md bg-blue-50/60 border border-blue-200/40 rounded-xl p-4 shadow-lg shadow-blue-900/5"
              >
                <div class="text-xs font-semibold text-blue-700 mb-3 uppercase tracking-wide">
                  Access Control (Group Owner)
                </div>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between items-start">
                    <span class="text-stone-600">Group ID:</span>
                    <span class="font-mono text-xs text-stone-800 break-all text-right">
                      {humanGroupData.$jazz.id}
                    </span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-stone-600">Members:</span>
                    <span class="font-semibold text-stone-800">
                      {humanGroupData.members?.length || 0}
                    </span>
                  </div>
                  {#if humanGroupData.members && humanGroupData.members.length > 0}
                    <div class="mt-3 pt-3 border-t border-blue-200/50">
                      <div class="text-xs font-semibold text-blue-700 mb-2">Admin Owners:</div>
                      <div class="space-y-1">
                        {#each humanGroupData.members as member}
                          {@const memberId = member.account?.$jazz?.id}
                          {@const memberRole = memberId ? humanGroupData.getRoleOf(memberId) : null}
                          {#if memberRole === "admin"}
                            <div class="flex justify-between items-center text-xs">
                              <span class="font-mono text-stone-600 break-all">
                                {memberId || "Unknown"}
                              </span>
                              <span
                                class="px-2 py-0.5 rounded bg-blue-200/60 text-blue-700 font-semibold"
                              >
                                {memberRole}
                              </span>
                            </div>
                          {/if}
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </section>
  {/if}
{/if}
