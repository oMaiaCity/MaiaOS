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
 * Creates project table + schema/data tables for flexible schema system
 */
async function createTables() {
  console.log("🚀 Creating Zero database schema (projects + schema/data tables)...\n");

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

    // Schema table - stores JSON Schema definitions
    // Using jsonb type - Zero's json() helper maps to jsonb in PostgreSQL
    console.log("📊 Creating schema table...");
    await db.schema
      .createTable("schema")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("ownedBy", "text", (col) => col.notNull())
      .addColumn("data", "jsonb", (col) => col.notNull()) // jsonb matches Zero's json() type
      .execute();
    console.log("✅ Schema table created\n");

    // Data table - stores actual data validated against schemas
    // Using jsonb type - Zero's json() helper maps to jsonb in PostgreSQL
    console.log("📊 Creating data table...");
    await db.schema
      .createTable("data")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("ownedBy", "text", (col) => col.notNull())
      .addColumn("schema", "text", (col) => col.notNull())
      .addColumn("data", "jsonb", (col) => col.notNull()) // jsonb matches Zero's json() type
      .execute();
    console.log("✅ Data table created\n");

    // Ensure columns are jsonb (migrate from text or json if needed)
    // Zero's json() helper expects jsonb columns in PostgreSQL
    console.log("📊 Checking column types...");
    try {
      // Check if schema.data exists and needs migration
      const schemaColumnCheck = await sql`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'schema' AND column_name = 'data'
      `.execute(db);
      
      if (schemaColumnCheck.rows.length > 0) {
        const currentType = schemaColumnCheck.rows[0].data_type;
        if (currentType === 'text') {
          console.log("📝 Migrating schema.data from text to jsonb...");
          await sql`
            ALTER TABLE schema 
            ALTER COLUMN data TYPE jsonb USING data::jsonb
          `.execute(db);
          console.log("✅ Migrated schema.data to jsonb\n");
        } else if (currentType === 'json') {
          console.log("📝 Migrating schema.data from json to jsonb...");
          await sql`
            ALTER TABLE schema 
            ALTER COLUMN data TYPE jsonb USING data::jsonb
          `.execute(db);
          console.log("✅ Migrated schema.data to jsonb\n");
        } else if (currentType === 'jsonb') {
          console.log("ℹ️  schema.data is already jsonb\n");
        } else {
          console.log(`⚠️  schema.data has unexpected type: ${currentType}\n`);
        }
      }
    } catch (error) {
      if (error.message?.includes("does not exist")) {
        console.log("ℹ️  Schema table doesn't exist yet, skipping check\n");
      } else {
        console.log(`ℹ️  Schema column check: ${error.message}\n`);
      }
    }

    try {
      // Check if data.data exists and needs migration
      const dataColumnCheck = await sql`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'data' AND column_name = 'data'
      `.execute(db);
      
      if (dataColumnCheck.rows.length > 0) {
        const currentType = dataColumnCheck.rows[0].data_type;
        if (currentType === 'text') {
          console.log("📝 Migrating data.data from text to jsonb...");
          await sql`
            ALTER TABLE data 
            ALTER COLUMN data TYPE jsonb USING data::jsonb
          `.execute(db);
          console.log("✅ Migrated data.data to jsonb\n");
        } else if (currentType === 'json') {
          console.log("📝 Migrating data.data from json to jsonb...");
          await sql`
            ALTER TABLE data 
            ALTER COLUMN data TYPE jsonb USING data::jsonb
          `.execute(db);
          console.log("✅ Migrated data.data to jsonb\n");
        } else if (currentType === 'jsonb') {
          console.log("ℹ️  data.data is already jsonb\n");
        } else {
          console.log(`⚠️  data.data has unexpected type: ${currentType}\n`);
        }
      }
    } catch (error) {
      if (error.message?.includes("does not exist")) {
        console.log("ℹ️  Data table doesn't exist yet, skipping check\n");
      } else {
        console.log(`ℹ️  Data column check: ${error.message}\n`);
      }
    }

    // Add foreign key constraint: data.schema references schema.id
    console.log("📊 Adding foreign key constraint...");
    try {
      await sql`
        ALTER TABLE data 
        ADD CONSTRAINT data_schema_fk 
        FOREIGN KEY (schema) REFERENCES schema(id)
      `.execute(db);
      console.log("✅ Foreign key constraint added\n");
    } catch (error) {
      if (error.message?.includes("already exists") || error.message?.includes("duplicate")) {
        console.log("ℹ️  Foreign key constraint already exists\n");
      } else {
        throw error;
      }
    }

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
 * Enables replica identity and creates publication for all Zero tables
 */
async function setupReplication() {
  console.log("🔄 Setting up replication...\n");

  const tables = ["project", "schema", "data"];

  // Enable replica identity for all tables
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
    await sql`CREATE PUBLICATION zero_data FOR TABLE project, schema, data`.execute(db);
    console.log("✅ Created publication 'zero_data'\n");
  } catch (error) {
    if (error.message?.includes("already exists")) {
      console.log("ℹ️  Publication 'zero_data' already exists\n");

      // Ensure all tables are included
      try {
        await sql`ALTER PUBLICATION zero_data ADD TABLE schema, data`.execute(db);
        console.log("✅ Updated publication to include schema and data tables\n");
      } catch (alterError) {
        if (alterError.message?.includes("already exists") || alterError.message?.includes("already in publication")) {
          console.log("ℹ️  Tables already in publication\n");
        } else {
          console.log(`ℹ️  Could not add tables to publication: ${alterError.message}\n`);
        }
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

/**
 * Seed hotel schema (owned by admin)
 */
async function seedHotelSchema() {
  const ADMIN = process.env.ADMIN;
  
  if (!ADMIN) {
    console.log("ℹ️  ADMIN not set, skipping hotel schema seeding\n");
    return;
  }

  console.log("📝 Checking if hotel schema seeding is needed...\n");

  try {
    // Check if hotel schema already exists
    const existingSchema = await sql`
      SELECT id FROM schema WHERE id = 'hotel-schema-v1'
    `.execute(db);

    if (existingSchema.rows.length > 0) {
      console.log("ℹ️  Hotel schema already exists, skipping seeding\n");
      return;
    }

    console.log(`📝 Creating hotel schema owned by admin: ${ADMIN}...\n`);

    // Read hotel schema JSON file
    const fs = await import('fs');
    const path = await import('path');
    const hotelSchemaPath = path.join(process.cwd(), 'libs/hominio-zero/src/schemas/hotel.json');
    
    let hotelSchemaJson;
    try {
      hotelSchemaJson = JSON.parse(fs.readFileSync(hotelSchemaPath, 'utf-8'));
    } catch (readError) {
      console.error(`❌ Error reading hotel schema file: ${readError.message}`);
      // Use inline schema as fallback
      hotelSchemaJson = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "title": "Hotel Schema",
        "description": "Schema for hotel data entries",
        "required": ["name", "address", "city", "country"],
        "properties": {
          "name": { "type": "string", "description": "Hotel name", "minLength": 1, "maxLength": 200 },
          "address": { "type": "string", "description": "Street address", "minLength": 1, "maxLength": 500 },
          "city": { "type": "string", "description": "City name", "minLength": 1, "maxLength": 100 },
          "country": { "type": "string", "description": "Country name", "minLength": 1, "maxLength": 100 },
          "rating": { "type": "number", "description": "Hotel rating (1-5 stars)", "minimum": 1, "maximum": 5 }
        },
        "additionalProperties": false
      };
    }

    // Insert hotel schema (data is stored as jsonb)
    await sql`
      INSERT INTO schema (id, "ownedBy", data)
      VALUES ('hotel-schema-v1', ${ADMIN}, ${JSON.stringify(hotelSchemaJson)}::jsonb)
    `.execute(db);

    console.log("✅ Hotel schema created successfully!\n");
    console.log(`   Schema ID: hotel-schema-v1\n`);
    console.log(`   Owner: ${ADMIN}\n`);
  } catch (error) {
    console.error("❌ Error seeding hotel schema:", error.message);
    // Don't throw - this is optional, migration can continue
    console.log("⚠️  Continuing migration despite hotel schema seeding error...\n");
  }
}

// Run migration
createTables()
  .then(() => migrateUserIdToOwnedBy())
  .then(() => seedAdminData())
  .then(() => seedHotelSchema())
  .then(() => {
    console.log("✨ Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error.message);
    process.exit(1);
  });
