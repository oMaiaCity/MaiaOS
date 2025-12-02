/**
 * Learn about schemas here:
 * https://jazz.tools/docs/svelte/schemas/covalues
 */

import { Group, co, z } from "jazz-tools";

/** Custom profile schema (no custom fields, using default) */
export const AccountProfile = co.profile();

/** Human schema - simple CoValue with @schema, name, and @label properties */
export const Human = co.map({
  "@schema": z.literal("human"),
  name: z.string(), // User-editable name (single source of truth)
  "@label": z.string(), // Reactively computed from name (or falls back to ID)
});

/** The account root is an app-specific per-user private `CoMap`
 *  where you can store top-level objects for that user */
export const AccountRoot = co.map({
  human: Human, // Human CoValue owned by humanGroup
});

export const JazzAccount = co
  .account({
    root: AccountRoot,
    profile: AccountProfile,
  })
  .withMigration(async (account) => {
    /** The account migration is run on account creation and on every log-in.
     *  You can use it to set up the account root and any other initial CoValues you need.
     */
    if (!account.$jazz.has("root")) {
      // Create humanGroup owned by the account (account is admin)
      const humanGroup = Group.create();
      // Add account as admin to the group
      humanGroup.addMember(account, "admin");

      // Create Human CoValue owned by humanGroup
      const human = Human.create(
        {
          "@schema": "human",
          name: "",
          "@label": "", // Will be computed reactively
        },
        { owner: humanGroup }
      );

      // Set up reactive computation: update @label when name changes
      // Compute initial @label
      const initialName = "";
      human.$jazz.set("@label", initialName || human.$jazz.id);
      
      human.$jazz.subscribe({}, (updatedHuman) => {
        if (updatedHuman.$isLoaded) {
          const name = updatedHuman.$jazz.has("name") ? updatedHuman.name.trim() : "";
          const computedLabel = name || updatedHuman.$jazz.id;
          // Only update if @label is different to avoid unnecessary updates
          if (!updatedHuman.$jazz.has("@label") || updatedHuman["@label"] !== computedLabel) {
            updatedHuman.$jazz.set("@label", computedLabel);
          }
        }
      });

      account.$jazz.set("root", {
        human,
      });
    } else {
      // Migration for existing accounts
      const loadedAccount = await account.$jazz.ensureLoaded({
        resolve: { root: { human: true } },
      });

      if (!loadedAccount.root.$jazz.has("human")) {
        // Create humanGroup owned by the account
        const humanGroup = Group.create();
        humanGroup.addMember(account, "admin");

        // Create Human CoValue
        const human = Human.create(
          {
            "@schema": "human",
            name: "",
            "@label": "", // Will be computed reactively
          },
          { owner: humanGroup }
        );

        // Set up reactive computation: update @label when name changes
        // Compute initial @label
        const initialName = "";
        human.$jazz.set("@label", initialName || human.$jazz.id);
        
        human.$jazz.subscribe({}, (updatedHuman) => {
          if (updatedHuman.$isLoaded) {
            const name = updatedHuman.$jazz.has("name") ? updatedHuman.name.trim() : "";
            const computedLabel = name || updatedHuman.$jazz.id;
            // Only update if @label is different to avoid unnecessary updates
            if (!updatedHuman.$jazz.has("@label") || updatedHuman["@label"] !== computedLabel) {
              updatedHuman.$jazz.set("@label", computedLabel);
            }
          }
        });

        loadedAccount.root.$jazz.set("human", human);
      } else {
        // Human exists - ensure its group has account as admin
        const human = await loadedAccount.root.$jazz.ensureLoaded({
          resolve: { human: true },
        });

        if (human.human?.$isLoaded) {
          const humanGroup = human.human.$jazz.owner as Group;
          // Ensure account is admin of the group
          try {
            humanGroup.addMember(account, "admin");
          } catch {
            // Already a member, ignore
          }
          // Migrate old "schema" field to "@schema" if needed
          if (human.human.$jazz.has("schema") && !human.human.$jazz.has("@schema")) {
            const oldSchema = (human.human as unknown as { schema?: string }).schema;
            human.human.$jazz.set("@schema", oldSchema || "human");
            // Remove old schema field (optional - can keep for backwards compatibility)
            // human.human.$jazz.set("schema", undefined);
          }
          // Ensure @schema field is set if missing
          if (!human.human.$jazz.has("@schema")) {
            human.human.$jazz.set("@schema", "human");
          }
          // Ensure name field exists
          if (!human.human.$jazz.has("name")) {
            human.human.$jazz.set("name", "");
          }

          // Migrate old "label" field to "@label" if needed
          if (human.human.$jazz.has("label") && !human.human.$jazz.has("@label")) {
            const oldLabel = (human.human as unknown as { label?: string }).label;
            human.human.$jazz.set("@label", oldLabel || human.human.$jazz.id);
            // Remove old label field (optional - can keep for backwards compatibility)
            // human.human.$jazz.set("label", undefined);
          }

          // Ensure @label field exists and compute initial value
          const currentName = human.human.$jazz.has("name") ? human.human.name.trim() : "";
          const computedLabel = currentName || human.human.$jazz.id;
          if (!human.human.$jazz.has("@label") || human.human["@label"] !== computedLabel) {
            human.human.$jazz.set("@label", computedLabel);
          }

          // Set up reactive computation: update @label when name changes
          // Subscription will automatically keep @label in sync with name changes
          human.human.$jazz.subscribe({}, (updatedHuman) => {
            if (updatedHuman.$isLoaded) {
              const name = updatedHuman.$jazz.has("name") ? updatedHuman.name.trim() : "";
              const computedLabel = name || updatedHuman.$jazz.id;
              // Only update if @label is different to avoid unnecessary updates
              if (!updatedHuman.$jazz.has("@label") || updatedHuman["@label"] !== computedLabel) {
                updatedHuman.$jazz.set("@label", computedLabel);
              }
            }
          });
        }
      }
    }
  });
