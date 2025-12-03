import Database from "better-sqlite3";
import { building } from "$app/environment";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

let _db: Database.Database | null = null;

/**
 * Get SQLite database instance
 * Database file is stored at libs/hominio-data/sqlite.db
 */
export function getAuthDb(): Database.Database {
  if (building) {
    // During build, return a stub to avoid errors
    // Better Auth will handle this gracefully
    return {} as Database.Database;
  }

  if (!_db) {
    // Database file path relative to package root
    const dbPath = resolve(__dirname, "../../sqlite.db");
    _db = new Database(dbPath);
    
    // Enable WAL mode for better concurrency
    _db.pragma("journal_mode = WAL");
  }

  return _db;
}

