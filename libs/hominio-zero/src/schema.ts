// Zero schema - Projects only (clean slate)
import {
  createSchema,
  createBuilder,
  table,
  string,
  definePermissions,
} from '@rocicorp/zero';

// Projects - reference implementation for future entity management
const project = table('project')
  .columns({
    id: string(),
    title: string(),
    description: string(),
    country: string(),
    city: string(),
    ownedBy: string(), // Owner of the project (user ID)
    videoUrl: string(), // YouTube URL for project pitch video (optional)
    bannerImage: string(), // Custom banner image URL (optional)
    profileImageUrl: string(), // Custom project profile image URL (optional)
    sdgs: string(), // JSON string array of SDG goals
    createdAt: string(), // ISO timestamp
  })
  .primaryKey('id');

export const schema = createSchema({
  tables: [project], // ONLY project table
  // Disable legacy queries - we use synced queries instead
  enableLegacyQueries: false,
  // Disable legacy CRUD mutators - we use custom mutators instead
  enableLegacyMutators: false,
});

// Export builder for synced queries
export const builder = createBuilder(schema);

// ⚠️ DUMMY PERMISSIONS - NOT USED ⚠️
// These permissions exist ONLY to satisfy zero-cache-dev's automatic deployment script.
// They are NOT enforced because:
// 1. enableLegacyQueries: false - clients can't run arbitrary queries
// 2. enableLegacyMutators: false - clients can't use CRUD mutators
// 
// Real security is enforced in:
// - Custom mutators (services/api/src/lib/mutators.server.ts) for writes
// - Synced queries (services/api/src/routes/v0/zero/get-queries.ts) for reads
type DummyAuthData = { sub: string };

export const permissions = definePermissions<DummyAuthData, typeof schema>(
  schema,
  () => ({})
);

export type Schema = typeof schema;

