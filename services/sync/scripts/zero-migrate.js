import { Kysely, sql } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";

// Bun automatically loads .env file
// Support both new name (ZERO_POSTGRES_SECRET) and old name (SECRET_ZERO_DEV_PG) for backward compatibility
const DATABASE_URL = process.env.ZERO_POSTGRES_SECRET || process.env.SECRET_ZERO_DEV_PG;

if (!DATABASE_URL) {
  console.error("❌ ZERO_POSTGRES_SECRET (or SECRET_ZERO_DEV_PG) environment variable is required");
  console.error(
    "💡 Make sure you have a .env file with ZERO_POSTGRES_SECRET set"
  );
  process.exit(1);
}

const db = new Kysely({
  dialect: new NeonDialect({
    neon: neon(DATABASE_URL),
  }),
});

/**
 * Clean migration system for Zero database schema
 * Creates ONLY project table (clean slate)
 */
async function createTables() {
  console.log("🚀 Creating Zero database schema (projects only)...\n");

  try {
    // Project table
    console.log("📊 Creating project table...");
    await db.schema
      .createTable("project")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("title", "text", (col) => col.notNull())
      .addColumn("description", "text", (col) => col.notNull())
      .addColumn("country", "text", (col) => col.notNull())
      .addColumn("city", "text", (col) => col.notNull())
      .addColumn("ownedBy", "text", (col) => col.notNull())
      .addColumn("videoUrl", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("bannerImage", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("profileImageUrl", "text", (col) =>
        col.notNull().defaultTo("")
      )
      .addColumn("sdgs", "text", (col) => col.notNull().defaultTo("[]"))
      .addColumn("createdAt", "text", (col) => col.notNull())
      .execute();
    console.log("✅ Project table created\n");

    // Setup replication for Zero tables
    await setupReplication();

    console.log("🎉 Zero database schema created successfully!\n");
    console.log(
      "⚠️  IMPORTANT: Restart your Zero cache server to pick up schema changes!"
    );
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

/**
 * Setup PostgreSQL logical replication for Zero
 * Enables replica identity and creates publication for project table only
 */
async function setupReplication() {
  console.log("🔄 Setting up replication...\n");

  const tables = ["project"];

  // Enable replica identity for project table
  for (const table of tables) {
    try {
      await sql`ALTER TABLE ${sql.raw(table)} REPLICA IDENTITY FULL`.execute(
        db
      );
      console.log(`✅ Enabled replica identity for ${table}`);
    } catch (error) {
      console.log(`ℹ️  Replica identity already set for ${table}`);
    }
  }

  console.log();

  // Create or update publication
  try {
    await sql`CREATE PUBLICATION zero_data FOR TABLE project`.execute(db);
    console.log("✅ Created publication 'zero_data'\n");
  } catch (error) {
    if (error.message?.includes("already exists")) {
      console.log("ℹ️  Publication 'zero_data' already exists\n");

      // Ensure project table is included
      try {
        await sql`ALTER PUBLICATION zero_data SET TABLE project`.execute(db);
        console.log("✅ Updated publication to include project table\n");
      } catch (alterError) {
        console.log("ℹ️  Publication already up to date\n");
      }
    } else {
      throw error;
    }
  }

    console.log("✅ Replication setup complete\n");
}

/**
 * Migrate existing userId column to ownedBy (if table exists)
 */
async function migrateUserIdToOwnedBy() {
  console.log("🔄 Checking for userId column migration...\n");

  try {
    // Check if userId column exists
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'project' AND column_name = 'userId'
    `.execute(db);

    if (columnCheck.rows.length > 0) {
      console.log("📝 Migrating userId column to ownedBy...\n");
      await sql`ALTER TABLE project RENAME COLUMN "userId" TO "ownedBy"`.execute(db);
      console.log("✅ Column renamed successfully\n");
    } else {
      console.log("ℹ️  No userId column found, skipping migration\n");
    }
  } catch (error) {
    console.log(`ℹ️  Column migration skipped: ${error.message}\n`);
  }
}

/**
 * Seed admin data (only if ADMIN_USER_ID is set)
 * Creates example project owned by admin user
 */
async function seedAdminData() {
  const ADMIN = process.env.ADMIN;
  
  if (!ADMIN) {
    console.log("ℹ️  ADMIN not set, skipping admin data seeding\n");
    return;
  }

  console.log("📝 Checking if admin data seeding is needed...\n");

  try {
    // Check if projects table has any rows
    const countResult = await sql`
      SELECT COUNT(*) as count FROM project
    `.execute(db);

    const count = parseInt(countResult.rows[0]?.count || "0", 10);

    if (count === 0) {
      console.log(`📝 Projects table is empty, creating example project owned by admin: ${ADMIN}...\n`);

      // Generate a unique ID for the example project
      const exampleProjectId = `example-project-${Date.now()}`;
      const now = new Date().toISOString();

      // Insert example project owned by admin
      await sql`
        INSERT INTO project (
          id, title, description, country, city, "ownedBy",
          "videoUrl", "bannerImage", "profileImageUrl", sdgs, "createdAt"
        ) VALUES (
          ${exampleProjectId},
          ${"Welcome to Hominio"},
          ${"This is an example project to help you get started. Create your own projects to showcase your work and connect with others!"},
          ${"Global"},
          ${"Everywhere"},
          ${ADMIN},
          ${""},
          ${""},
          ${""},
          ${"[]"},
          ${now}
        )
      `.execute(db);

      console.log("✅ Example project created successfully!\n");
      console.log(`   Project ID: ${exampleProjectId}\n`);
      console.log(`   Owner: ${ADMIN}\n`);
    } else {
      console.log(`ℹ️  Projects table already has ${count} project(s), skipping admin data seeding\n`);
    }
  } catch (error) {
    console.error("❌ Error seeding admin data:", error.message);
    // Don't throw - this is optional, migration can continue
    console.log("⚠️  Continuing migration despite admin data seeding error...\n");
  }
}

// Run migration
createTables()
  .then(() => migrateUserIdToOwnedBy())
  .then(() => seedAdminData())
  .then(() => {
    console.log("✨ Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error.message);
    process.exit(1);
  });
