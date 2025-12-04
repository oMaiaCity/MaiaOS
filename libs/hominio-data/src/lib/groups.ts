/**
 * Coop Management API
 */

import { Group, co } from "jazz-tools";
import type { JazzAccount } from "./schema.js";
import { Coop } from "./schema.js";

/**
 * Create a new Coop CoValue (Jazz auto-creates a Group as owner)
 */
export async function createCoop(account: co.loaded<typeof JazzAccount>): Promise<co.loaded<typeof Coop>> {
    // Create Coop CoValue - Jazz automatically creates a Group as owner
    // The account will be added as admin to the auto-created group
    const coop = Coop.create({
        "@schema": "coop",
        name: "New Coop",
        "@label": "",
    });
    await coop.$jazz.waitForSync();


    // Set up reactive @label computation
    const { setupReactiveLabel } = await import("./schema.js");
    setupReactiveLabel(coop);

    const root = await account.$jazz.ensureLoaded({ resolve: { root: { o: { coops: true } } } });
    if (!root.root || !root.root.o) {
        throw new Error("Failed to load account root.o");
    }

    const currentCoops = root.root.o.$jazz.has("coops") && root.root.o.coops?.$isLoaded
        ? Array.from(root.root.o.coops)
        : [];

    root.root.o.$jazz.set("coops", [...currentCoops, coop]);
    await root.root.o.$jazz.waitForSync();

    return coop;
}

/**
 * Remove a coop from persisted list
 */
export async function removeCoop(account: co.loaded<typeof JazzAccount>, coop: co.loaded<typeof Coop>): Promise<void> {
    const root = await account.$jazz.ensureLoaded({ resolve: { root: { o: { coops: true } } } });
    if (!root.root || !root.root.o) {
        throw new Error("Failed to load account root.o");
    }

    const currentCoops = root.root.o.$jazz.has("coops") && root.root.o.coops?.$isLoaded
        ? Array.from(root.root.o.coops)
        : [];

    root.root.o.$jazz.set("coops", currentCoops.filter((c) => {
        if (!c.$isLoaded) return true;
        return c.$jazz.id !== coop.$jazz.id;
    }));
    await root.root.o.$jazz.waitForSync();
}

/**
 * Get group information for any CoValue
 * Returns the owner Group, members, and parent groups
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCoValueGroupInfo(coValue: any) {
    const owner = coValue.$jazz.owner;
    const ownerGroup = owner && "members" in owner ? owner as Group : null;

    if (!ownerGroup) {
        return {
            groupId: null,
            owner: null,
            accountMembers: [],
            groupMembers: [],
        };
    }

    const accountMembers = Array.from(ownerGroup.members || [])
        .filter((m) => m.account)
        .map((m) => {
            const memberId = m.account.$jazz.id;
            const role = ownerGroup.getRoleOf(memberId);
            return { id: memberId, role: role || "unknown", type: "account" as const };
        })
        .filter((m) => m.role && m.role !== "revoked");

    const parentGroups = ownerGroup.getParentGroups ? ownerGroup.getParentGroups() : [];
    const groupMembers = parentGroups.map((g) => {
        const memberId = g.$jazz.id;
        const role = ownerGroup.getRoleOf(memberId) || "admin";
        return { id: memberId, role, type: "group" as const };
    });

    return {
        groupId: ownerGroup.$jazz.id,
        owner: ownerGroup.$jazz.owner,
        accountMembers,
        groupMembers,
    };
}
