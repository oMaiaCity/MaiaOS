import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { grantCapabilityGroup } from "@hominio/caps";
import { requireAdmin } from "$lib/api-helpers";

/**
 * POST /api/admin/capability-groups/auto-assign
 * Grant Hominio Explorer group to a user (admin only)
 * Note: This endpoint is typically called programmatically after signup via BetterAuth hooks
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    await requireAdmin(request);
    const { userId, groupName = "hominio-explorer" } = await request.json();

    if (!userId) {
      return json({ error: "userId is required" }, { status: 400 });
    }

    const ADMIN = process.env.ADMIN;
    if (!ADMIN) {
      return json({ error: "ADMIN not configured" }, { status: 500 });
    }

    const issuerPrincipal = `user:${ADMIN}`;
    const userPrincipal = `user:${userId}`;

    await grantCapabilityGroup(issuerPrincipal, userPrincipal, groupName);

    return json({ success: true, message: `Granted ${groupName} group to user ${userId}` });
  } catch (error: any) {
    console.error("[Admin] Error auto-assigning group capability:", error);
    // If user already has the group, that's okay
    if (error.message?.includes("already")) {
      return json({ success: true, message: "User already has this group" });
    }
    return json({ error: error.message }, { status: 500 });
  }
};

