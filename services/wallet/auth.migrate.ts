/**
 * Minimal BetterAuth config for CLI migrations
 * This file is used by @better-auth/cli migrate command
 * It doesn't import SvelteKit modules to avoid CLI errors
 */
import { betterAuth } from "better-auth";
import { Kysely, sql } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env file from root (../../.env)
try {
  const envPath = resolve(__dirname, "../../.env");
  const envFile = readFileSync(envPath, "utf-8");
  envFile.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
} catch (error) {
  // .env file might not exist, that's okay
}

const DATABASE_URL = process.env.WALLET_POSTGRES_SECRET;
const AUTH_SECRET = process.env.AUTH_SECRET || "temp-secret-for-migration";

if (!DATABASE_URL) {
  throw new Error("WALLET_POSTGRES_SECRET environment variable is required");
}

// Create Kysely instance
const db = new Kysely({
  dialect: new NeonDialect({
    neon: neon(DATABASE_URL),
  }),
});

// Minimal BetterAuth instance for migrations
export const auth = betterAuth({
  database: {
    db: db,
    type: "postgres",
  },
  secret: AUTH_SECRET,
  // Add plugins if needed (but keep minimal for migrations)
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    }
    : undefined,
});

/**
 * Migrate capabilities tables
 * This extends BetterAuth migrations with capability-based access control tables
 */
export async function migrateCapabilities(dbInstance: Kysely<any>) {
  console.log("🔄 Migrating capabilities tables...\n");

  try {
    // Capabilities table
    await dbInstance.schema
      .createTable("capabilities")
      .ifNotExists()
      .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn("principal", "varchar(255)", (col) => col.notNull())
      .addColumn("resource_type", "varchar(50)", (col) => col.notNull())
      .addColumn("resource_namespace", "varchar(255)", (col) => col.notNull())
      .addColumn("resource_id", "varchar(255)")
      .addColumn("device_id", "varchar(255)")
      .addColumn("actions", sql`text[]`, (col) => col.notNull())
      .addColumn("conditions", sql`jsonb`)
      .addColumn("metadata", sql`jsonb`, (col) => col.notNull())
      .addColumn("title", "varchar(255)") // Human-readable title
      .addColumn("description", "text") // Human-readable description
      .addColumn("created_at", "timestamp", (col) => col.defaultTo(sql`NOW()`))
      .addColumn("updated_at", "timestamp", (col) => col.defaultTo(sql`NOW()`))
      .execute();

    console.log("✅ Created capabilities table");

    // Capability requests table
    await dbInstance.schema
      .createTable("capability_requests")
      .ifNotExists()
      .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn("requester_principal", "varchar(255)", (col) => col.notNull())
      .addColumn("resource_type", "varchar(50)", (col) => col.notNull())
      .addColumn("resource_namespace", "varchar(255)", (col) => col.notNull())
      .addColumn("resource_id", "varchar(255)")
      .addColumn("device_id", "varchar(255)")
      .addColumn("actions", sql`text[]`, (col) => col.notNull())
      .addColumn("owner_id", "varchar(255)", (col) => col.notNull())
      .addColumn("status", "varchar(50)", (col) => col.defaultTo("pending"))
      .addColumn("message", "text")
      .addColumn("callback_url", "text")
      .addColumn("created_at", "timestamp", (col) => col.defaultTo(sql`NOW()`))
      .addColumn("updated_at", "timestamp", (col) => col.defaultTo(sql`NOW()`))
      .execute();

    console.log("✅ Created capability_requests table");

    // Create indexes
    try {
      await dbInstance.schema
        .createIndex("idx_capabilities_principal")
        .on("capabilities")
        .column("principal")
        .execute();
      console.log("✅ Created index idx_capabilities_principal");
    } catch (error: any) {
      if (!error.message?.includes("already exists")) {
        throw error;
      }
    }

    try {
      await dbInstance.schema
        .createIndex("idx_capabilities_resource")
        .on("capabilities")
        .columns(["resource_type", "resource_namespace", "resource_id"])
        .execute();
      console.log("✅ Created index idx_capabilities_resource");
    } catch (error: any) {
      if (!error.message?.includes("already exists")) {
        throw error;
      }
    }

    try {
      await dbInstance.schema
        .createIndex("idx_capability_requests_owner")
        .on("capability_requests")
        .columns(["owner_id", "status"])
        .execute();
      console.log("✅ Created index idx_capability_requests_owner");
    } catch (error: any) {
      if (!error.message?.includes("already exists")) {
        throw error;
      }
    }

    try {
      await dbInstance.schema
        .createIndex("idx_capability_requests_requester")
        .on("capability_requests")
        .columns(["requester_principal", "status"])
        .execute();
      console.log("✅ Created index idx_capability_requests_requester");
    } catch (error: any) {
      if (!error.message?.includes("already exists")) {
        throw error;
      }
    }

    // Add title and description columns if they don't exist (for existing tables)
    try {
      await dbInstance.schema
        .alterTable("capabilities")
        .addColumn("title", "varchar(255)")
        .execute();
      console.log("✅ Added title column to capabilities table");
    } catch (error: any) {
      if (error.message?.includes("already exists") || error.message?.includes("duplicate")) {
        console.log("ℹ️  Title column already exists, skipping");
      } else {
        // Re-throw unexpected errors (connection issues, permissions, etc.)
        throw error;
      }
    }

    try {
      await dbInstance.schema
        .alterTable("capabilities")
        .addColumn("description", "text")
        .execute();
      console.log("✅ Added description column to capabilities table");
    } catch (error: any) {
      if (error.message?.includes("already exists") || error.message?.includes("duplicate")) {
        console.log("ℹ️  Description column already exists, skipping");
      } else {
        // Re-throw unexpected errors (connection issues, permissions, etc.)
        throw error;
      }
    }

    console.log("\n✅ Capabilities migration completed successfully!\n");
  } catch (error) {
    console.error("❌ Capabilities migration failed:", error);
    throw error;
  }
}

/**
 * Seed admin capabilities (only if ADMIN is set)
 * Grants api:voice capability to admin user (allows using voice API)
 */
export async function seedAdminCapabilities(dbInstance: Kysely<any>) {
  const ADMIN = process.env.ADMIN;

  if (!ADMIN) {
    console.log("ℹ️  ADMIN not set, skipping admin capability seeding\n");
    return;
  }

  console.log("📝 Checking if admin capability seeding is needed...\n");

  try {
    const principal = `user:${ADMIN}`;

    // Check if admin already has voice API capability
    const existingCapability = await dbInstance
      .selectFrom("capabilities")
      .selectAll()
      .where("principal", "=", principal)
      .where("resource_type", "=", "api")
      .where("resource_namespace", "=", "voice")
      .executeTakeFirst();

    if (existingCapability) {
      // Update existing capability with title and description if missing
      if (!existingCapability.title || !existingCapability.description) {
        console.log(`📝 Updating existing admin voice capability with title and description...\n`);
        await dbInstance
          .updateTable("capabilities")
          .set({
            title: "Voice Assistant Access",
            description: "Unlimited voice minutes",
            updated_at: new Date(),
          })
          .where("id", "=", existingCapability.id)
          .execute();
        console.log("✅ Updated existing admin voice capability with title and description!\n");
      } else {
        console.log(`ℹ️  Admin ${ADMIN} already has voice API capability with title/description, skipping\n`);
      }
      // Continue to check schema and hotel capabilities (don't return early)
    } else {
      console.log(`📝 Granting voice API capability to admin: ${ADMIN}...\n`);

      // Grant api:voice capability to admin (allows using voice API endpoint)
      await dbInstance
        .insertInto("capabilities")
        .values({
          id: sql`gen_random_uuid()`,
          principal: principal,
          resource_type: "api",
          resource_namespace: "voice",
          resource_id: null, // API resources don't have specific IDs (applies to all voice endpoints)
          device_id: null,
          actions: ["read"], // Read = use/call the voice API
          conditions: null,
          metadata: {
            granted_by: "system",
            reason: "admin_seeding",
            created_at: new Date().toISOString(),
          },
          title: "Voice Assistant Access",
          description: "Unlimited voice minutes",
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      console.log("✅ Admin voice API capability granted successfully!\n");
      console.log(`   Principal: ${principal}\n`);
      console.log(`   Resource: api:voice\n`);
      console.log(`   Actions: read\n`);
    }

    // Grant admin wildcard access to schema table
    const existingSchemaCapability = await dbInstance
      .selectFrom("capabilities")
      .selectAll()
      .where("principal", "=", principal)
      .where("resource_type", "=", "data")
      .where("resource_namespace", "=", "schema")
      .where("resource_id", "=", "*")
      .executeTakeFirst();

    if (!existingSchemaCapability) {
      console.log(`📝 Granting schema wildcard capability to admin: ${ADMIN}...\n`);

      await dbInstance
        .insertInto("capabilities")
        .values({
          id: sql`gen_random_uuid()`,
          principal: principal,
          resource_type: "data",
          resource_namespace: "schema",
          resource_id: "*", // Wildcard - access to all schemas
          device_id: null,
          actions: ["read", "write", "delete", "manage"], // Full access
          conditions: null,
          metadata: {
            granted_by: "system",
            reason: "admin_seeding",
            created_at: new Date().toISOString(),
          },
          title: "Schema Management Access",
          description: "Full access to manage all schemas",
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      console.log("✅ Admin schema wildcard capability granted successfully!\n");
      console.log(`   Principal: ${principal}\n`);
      console.log(`   Resource: data:schema:*\n`);
      console.log(`   Actions: read, write, delete, manage\n`);
    } else {
      console.log(`ℹ️  Admin ${ADMIN} already has schema wildcard capability, skipping\n`);
    }

    // Grant admin wildcard access to hotel data entries only (not all data)
    // This allows CRUD operations on hotels (data entries with schema='hotel-schema-v1')
    const existingHotelCapability = await dbInstance
      .selectFrom("capabilities")
      .selectAll()
      .where("principal", "=", principal)
      .where("resource_type", "=", "data")
      .where("resource_namespace", "=", "hotel-schema-v1")
      .where("resource_id", "=", "*")
      .executeTakeFirst();

    if (!existingHotelCapability) {
      console.log(`📝 Granting hotel data wildcard capability to admin: ${ADMIN}...\n`);

      await dbInstance
        .insertInto("capabilities")
        .values({
          id: sql`gen_random_uuid()`,
          principal: principal,
          resource_type: "data",
          resource_namespace: "hotel-schema-v1", // Hotel schema namespace
          resource_id: "*", // Wildcard - access to all hotel data entries
          device_id: null,
          actions: ["read", "write", "delete", "manage"], // Full CRUD access
          conditions: null,
          metadata: {
            granted_by: "system",
            reason: "admin_seeding",
            created_at: new Date().toISOString(),
          },
          title: "Hotel Management Access",
          description: "Full access to manage all hotel data entries",
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      console.log("✅ Admin hotel data wildcard capability granted successfully!\n");
      console.log(`   Principal: ${principal}\n`);
      console.log(`   Resource: data:hotel-schema-v1:*\n`);
      console.log(`   Actions: read, write, delete, manage\n`);
    } else {
      console.log(`ℹ️  Admin ${ADMIN} already has hotel data wildcard capability, skipping\n`);
    }
  } catch (error: any) {
    console.error("❌ Error seeding admin capabilities:", error.message);
    // Don't throw - this is optional, migration can continue
    console.log("⚠️  Continuing migration despite admin capability seeding error...\n");
  }
}

// Run capabilities migration if this file is executed directly
// This allows running: bun run auth.migrate.ts
if (import.meta.main) {
  migrateCapabilities(db)
    .then(() => seedAdminCapabilities(db))
    .then(() => {
      console.log("✨ Capabilities migration completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Capabilities migration failed:", error.message);
      process.exit(1);
    });
}

