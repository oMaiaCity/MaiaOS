/**
 * Seeding API — sync / server only. Not re-exported from @MaiaOS/db main entry (keeps SPA free of factory .maia graph).
 */
export { seed, simpleAccountSeed } from './migrations/seeding/seed.js'
