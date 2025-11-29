import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAdmin } from "$lib/api-helpers";
import { getAuthDb } from "$lib/db.server";
import { Kysely, sql } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";

/**
 * POST /api/admin/capability-groups/hominio-explorer/add-hotel-capability
 * Manually add "read all hotels" capability to Hominio Explorer group
 * This can be called if the migration didn't run or the schema wasn't found
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    await requireAdmin(request);
    const db = getAuthDb();
    const ADMIN = process.env.ADMIN;
    if (!ADMIN) {
      return json({ error: "ADMIN not configured" }, { status: 500 });
    }

    const principal = `user:${ADMIN}`;

    // Find Hominio Explorer group
    const group = await db
      .selectFrom("capability_groups")
      .selectAll()
      .where("name", "=", "hominio-explorer")
      .executeTakeFirst();

    if (!group) {
      return json({ error: "Hominio Explorer group not found. Run migration first." }, { status: 404 });
    }

    // Get hotel schema ID
    let hotelSchemaId: string | null = null;
    const ZERO_POSTGRES_SECRET = process.env.ZERO_POSTGRES_SECRET;

    if (!ZERO_POSTGRES_SECRET) {
      return json({ error: "ZERO_POSTGRES_SECRET not set. Cannot query for hotel schema." }, { status: 500 });
    }

    try {
      const zeroDb = new Kysely<any>({
        dialect: new NeonDialect({
          neon: neon(ZERO_POSTGRES_SECRET),
        }),
      });

      const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "@hominio";
      const schemaName = `${ADMIN_USERNAME}/hotel-v1`;

      const schemaResult = await sql`
        SELECT id FROM schema 
        WHERE name = ${schemaName}
        LIMIT 1
      `.execute(zeroDb);

      if (schemaResult.rows.length > 0) {
        hotelSchemaId = schemaResult.rows[0].id as string;
      } else {
        return json({ error: `Hotel schema "${schemaName}" not found in Zero database` }, { status: 404 });
      }
    } catch (error: any) {
      return json({ error: `Could not query Zero database: ${error.message}` }, { status: 500 });
    }

    // Check if capability already exists
    const groupPrincipal = `group:hominio-explorer`;
    const existingCapability = await db
      .selectFrom("capabilities")
      .selectAll()
      .where("principal", "=", groupPrincipal)
      .where("resource_type", "=", "data")
      .where("resource_namespace", "=", hotelSchemaId)
      .where("resource_id", "=", "*")
      .executeTakeFirst();

    let capabilityId: string;

    if (existingCapability) {
      capabilityId = existingCapability.id;
    } else {
      // Create the capability for the group
      const capabilityResult = await db
        .insertInto("capabilities")
        .values({
          id: sql`gen_random_uuid()`,
          principal: groupPrincipal,
          resource_type: "data",
          resource_namespace: hotelSchemaId,
          resource_id: "*",
          device_id: null,
          actions: ["read"],
          conditions: null,
          metadata: {
            group: "hominio-explorer",
            issuedAt: new Date().toISOString(),
            issuer: principal,
          },
          title: "Read All Hotels",
          description: "Read access to all hotel listings",
          created_at: sql`NOW()`,
          updated_at: sql`NOW()`,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      capabilityId = capabilityResult.id;
    }

    // Link capability to group (if not already linked)
    const existingLink = await db
      .selectFrom("capability_group_members")
      .selectAll()
      .where("group_id", "=", group.id)
      .where("capability_id", "=", capabilityId)
      .executeTakeFirst();

    if (existingLink) {
      return json({
        success: true,
        message: "Capability already linked to group",
        capabilityId,
        groupId: group.id
      });
    }

    await db
      .insertInto("capability_group_members")
      .values({
        id: sql`gen_random_uuid()`,
        group_id: group.id,
        capability_id: capabilityId,
        created_at: sql`NOW()`,
      })
      .execute();

    return json({
      success: true,
      message: "Successfully added 'read all hotels' capability to Hominio Explorer group",
      capabilityId,
      groupId: group.id,
      hotelSchemaId
    });
  } catch (error: any) {
    console.error("[Admin] Error adding hotel capability to group:", error);
    return json({ error: error.message }, { status: 500 });
  }
};

