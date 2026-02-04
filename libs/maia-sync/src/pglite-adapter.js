/**
 * PGlite Adapter for CoJSON Storage
 * 
 * Implements DBClientInterfaceAsync using PGlite (WebAssembly PostgreSQL).
 * Uses the same PostgreSQL SQL interface, making it easy to migrate to Fly Postgres later.
 */

import { PGlite } from '@electric-sql/pglite';
import { DeletedCoValueDeletionStatus } from 'cojson/dist/storage/types.js';
import { logger, emptyKnownState } from 'cojson';

/**
 * Convert SQLite migrations to PostgreSQL-compatible SQL
 * Uses quoted identifiers to preserve case
 */
const migrations = {
  1: [
    `CREATE TABLE IF NOT EXISTS transactions (
      ses INTEGER,
      idx INTEGER,
      tx TEXT NOT NULL,
      PRIMARY KEY (ses, idx)
    );`,
    `CREATE TABLE IF NOT EXISTS sessions (
      "rowID" SERIAL PRIMARY KEY,
      "coValue" INTEGER NOT NULL,
      "sessionID" TEXT NOT NULL,
      "lastIdx" INTEGER,
      "lastSignature" TEXT,
      UNIQUE ("sessionID", "coValue")
    );`,
    'CREATE INDEX IF NOT EXISTS sessionsByCoValue ON sessions ("coValue");',
    `CREATE TABLE IF NOT EXISTS coValues (
      "rowID" SERIAL PRIMARY KEY,
      id TEXT NOT NULL UNIQUE,
      header TEXT NOT NULL
    );`,
    'CREATE INDEX IF NOT EXISTS coValuesByID ON coValues (id);',
  ],
  3: [
    `CREATE TABLE IF NOT EXISTS signatureAfter (
      ses INTEGER,
      idx INTEGER,
      signature TEXT NOT NULL,
      PRIMARY KEY (ses, idx)
    );`,
    'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "bytesSinceLastSignature" INTEGER;',
  ],
  4: [
    `CREATE TABLE IF NOT EXISTS unsynced_covalues (
      "rowID" SERIAL PRIMARY KEY,
      "co_value_id" TEXT NOT NULL,
      "peer_id" TEXT NOT NULL,
      UNIQUE ("co_value_id", "peer_id")
    );`,
    'CREATE INDEX IF NOT EXISTS idx_unsynced_covalues_co_value_id ON unsynced_covalues("co_value_id");',
  ],
  5: [
    `CREATE TABLE IF NOT EXISTS deletedCoValues (
      "coValueID" TEXT PRIMARY KEY,
      status INTEGER NOT NULL DEFAULT 0
    );`,
    'CREATE INDEX IF NOT EXISTS deletedCoValuesByStatus ON deletedCoValues (status);',
  ],
};

/**
 * Get migration version from schema_version table
 */
async function getMigrationVersion(db) {
  try {
    const result = await db.query('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1');
    return result.rows[0]?.version || 0;
  } catch {
    // Table doesn't exist yet, return 0
    return 0;
  }
}

/**
 * Save migration version
 */
async function saveMigrationVersion(db, version) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO schema_version (version) VALUES (${version})
    ON CONFLICT (version) DO NOTHING;
  `);
}

/**
 * Run migrations
 */
async function runMigrations(db) {
  const currentVersion = await getMigrationVersion(db);
  const versions = Object.keys(migrations)
    .map(v => parseInt(v, 10))
    .filter(v => v > currentVersion)
    .sort((a, b) => a - b);

  for (const version of versions) {
    const queries = migrations[version];
    for (const query of queries) {
      await db.exec(query);
    }
    await saveMigrationVersion(db, version);
  }
}

/**
 * PGlite Transaction Interface
 */
class PGliteTransaction {
  constructor(db) {
    this.db = db;
  }

  async getSingleCoValueSession(coValueRowId, sessionID) {
    const result = await this.db.query(
      'SELECT * FROM sessions WHERE "coValue" = $1 AND "sessionID" = $2',
      [coValueRowId, sessionID]
    );
    const row = result.rows[0];
    if (!row) return undefined;
    
    return {
      rowID: row.rowID || row.rowid,
      coValue: row.coValue || row.covalue,
      sessionID: row.sessionID || row.sessionid,
      lastIdx: row.lastIdx || row.lastidx,
      lastSignature: row.lastSignature || row.lastsignature,
      bytesSinceLastSignature: row.bytesSinceLastSignature || row.bytessincelastsignature,
    };
  }

  async markCoValueAsDeleted(id) {
    await this.db.query(
      'INSERT INTO deletedCoValues (coValueID, status) VALUES ($1, $2) ON CONFLICT (coValueID) DO NOTHING',
      [id, DeletedCoValueDeletionStatus.Pending]
    );
  }

  async addSessionUpdate({ sessionUpdate, sessionRow }) {
    if (sessionRow) {
      // Update existing session
      const result = await this.db.query(
        `UPDATE sessions 
         SET "lastIdx" = $1, "lastSignature" = $2, "bytesSinceLastSignature" = $3
         WHERE "rowID" = $4
         RETURNING "rowID"`,
        [
          sessionUpdate.lastIdx,
          sessionUpdate.lastSignature,
          sessionUpdate.bytesSinceLastSignature,
          sessionRow.rowID,
        ]
      );
      return result.rows[0]?.rowID || sessionRow.rowID;
    } else {
      // Insert new session
      const result = await this.db.query(
        `INSERT INTO sessions ("coValue", "sessionID", "lastIdx", "lastSignature", "bytesSinceLastSignature") 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("sessionID", "coValue") 
         DO UPDATE SET "lastIdx" = EXCLUDED."lastIdx", "lastSignature" = EXCLUDED."lastSignature", "bytesSinceLastSignature" = EXCLUDED."bytesSinceLastSignature"
         RETURNING "rowID"`,
        [
          sessionUpdate.coValue,
          sessionUpdate.sessionID,
          sessionUpdate.lastIdx,
          sessionUpdate.lastSignature,
          sessionUpdate.bytesSinceLastSignature,
        ]
      );
      if (!result.rows[0]) {
        throw new Error('Failed to add session update');
      }
      return result.rows[0].rowID;
    }
  }

  async addTransaction(sessionRowID, idx, newTransaction) {
    await this.db.query(
      'INSERT INTO transactions (ses, idx, tx) VALUES ($1, $2, $3)',
      [sessionRowID, idx, JSON.stringify(newTransaction)]
    );
  }

  async addSignatureAfter({ sessionRowID, idx, signature }) {
    await this.db.query(
      'INSERT INTO signatureAfter (ses, idx, signature) VALUES ($1, $2, $3)',
      [sessionRowID, idx, signature]
    );
  }
}

/**
 * PGlite Client implementing DBClientInterfaceAsync
 */
export class PGliteClient {
  constructor(db) {
    this.db = db;
  }

  async getCoValue(coValueId) {
    const result = await this.db.query(
      'SELECT * FROM coValues WHERE id = $1',
      [coValueId]
    );

    if (!result.rows[0]) return undefined;

    const row = result.rows[0];
    try {
      const header = typeof row.header === 'string' 
        ? JSON.parse(row.header) 
        : row.header;

      return {
        rowID: row.rowID || row.rowid,
        id: row.id,
        header: header,
      };
    } catch (e) {
      logger.warn(`Invalid JSON in header: ${row.header}`, {
        id: coValueId,
        err: e,
      });
      return undefined;
    }
  }

  async upsertCoValue(id, header) {
    if (!header) {
      const result = await this.db.query(
        'SELECT "rowID" FROM coValues WHERE id = $1',
        [id]
      );
      return result.rows[0]?.rowID || result.rows[0]?.rowid;
    }

    const result = await this.db.query(
      `INSERT INTO coValues (id, header) VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING
       RETURNING "rowID"`,
      [id, JSON.stringify(header)]
    );

    if (result.rows[0]) {
      return result.rows[0].rowID || result.rows[0].rowid;
    }

    // If insert didn't happen (conflict), get existing rowID
    const existing = await this.db.query(
      'SELECT "rowID" FROM coValues WHERE id = $1',
      [id]
    );
    return existing.rows[0]?.rowID || existing.rows[0]?.rowid;
  }

  async getAllCoValuesWaitingForDelete() {
    const result = await this.db.query(
      'SELECT "coValueID" FROM deletedCoValues WHERE status = $1',
      [DeletedCoValueDeletionStatus.Pending]
    );
    return result.rows.map(r => r.coValueID || r.covalueid);
  }

  async getCoValueSessions(coValueRowId) {
    const result = await this.db.query(
      'SELECT * FROM sessions WHERE "coValue" = $1',
      [coValueRowId]
    );
    return result.rows.map(row => ({
      rowID: row.rowID || row.rowid,
      coValue: row.coValue || row.covalue,
      sessionID: row.sessionID || row.sessionid,
      lastIdx: row.lastIdx || row.lastidx,
      lastSignature: row.lastSignature || row.lastsignature,
      bytesSinceLastSignature: row.bytesSinceLastSignature || row.bytessincelastsignature,
    }));
  }

  async getNewTransactionInSession(sessionRowId, fromIdx, toIdx) {
    const result = await this.db.query(
      'SELECT * FROM transactions WHERE ses = $1 AND idx >= $2 AND idx <= $3 ORDER BY idx',
      [sessionRowId, fromIdx, toIdx]
    );

    return result.rows.map(row => {
      try {
        return {
          ses: row.ses,
          idx: row.idx,
          tx: typeof row.tx === 'string' ? JSON.parse(row.tx) : row.tx,
        };
      } catch (e) {
        logger.warn('Invalid JSON in transaction', { err: e });
        return null;
      }
    }).filter(Boolean);
  }

  async getSignatures(sessionRowId, firstNewTxIdx) {
    const result = await this.db.query(
      'SELECT * FROM signatureAfter WHERE ses = $1 AND idx >= $2 ORDER BY idx',
      [sessionRowId, firstNewTxIdx]
    );
    return result.rows.map(row => ({
      ses: row.ses,
      idx: row.idx,
      signature: row.signature,
    }));
  }

  async transaction(callback) {
    await this.db.exec('BEGIN');
    try {
      const tx = new PGliteTransaction(this.db);
      await callback(tx);
      await this.db.exec('COMMIT');
    } catch (e) {
      await this.db.exec('ROLLBACK');
      throw e;
    }
  }

  async trackCoValuesSyncState(updates) {
    for (const update of updates) {
      if (update.synced) {
        await this.db.query(
          'DELETE FROM unsynced_covalues WHERE "co_value_id" = $1 AND "peer_id" = $2',
          [update.id, update.peerId]
        );
      } else {
        await this.db.query(
          'INSERT INTO unsynced_covalues ("co_value_id", "peer_id") VALUES ($1, $2) ON CONFLICT ("co_value_id", "peer_id") DO NOTHING',
          [update.id, update.peerId]
        );
      }
    }
  }

  async getUnsyncedCoValueIDs() {
    const result = await this.db.query(
      'SELECT DISTINCT "co_value_id" FROM unsynced_covalues'
    );
    return result.rows.map(row => row.co_value_id);
  }

  async stopTrackingSyncState(id) {
    await this.db.query(
      'DELETE FROM unsynced_covalues WHERE "co_value_id" = $1',
      [id]
    );
  }

  async eraseCoValueButKeepTombstone(coValueID) {
    const coValueRow = await this.db.query(
      'SELECT "rowID" FROM coValues WHERE id = $1',
      [coValueID]
    );

    if (!coValueRow.rows[0]) {
      logger.warn(`CoValue ${coValueID} not found, skipping deletion`);
      return;
    }

    const rowId = coValueRow.rows[0].rowID || coValueRow.rows[0].rowid;

    await this.transaction(async (tx) => {
      await this.db.query(
        `DELETE FROM transactions
         WHERE ses IN (
           SELECT "rowID" FROM sessions
           WHERE "coValue" = $1 AND "sessionID" NOT LIKE '%$'
         )`,
        [rowId]
      );

      await this.db.query(
        `DELETE FROM signatureAfter
         WHERE ses IN (
           SELECT "rowID" FROM sessions
           WHERE "coValue" = $1 AND "sessionID" NOT LIKE '%$'
         )`,
        [rowId]
      );

      await this.db.query(
        `DELETE FROM sessions
         WHERE "coValue" = $1 AND "sessionID" NOT LIKE '%$'`,
        [rowId]
      );

      await this.db.query(
        `INSERT INTO deletedCoValues ("coValueID", status) VALUES ($1, $2)
         ON CONFLICT ("coValueID") DO UPDATE SET status = $2`,
        [coValueID, DeletedCoValueDeletionStatus.Done]
      );
    });
  }

  async getCoValueKnownState(coValueId) {
    const coValueRow = await this.db.query(
      'SELECT "rowID" FROM coValues WHERE id = $1',
      [coValueId]
    );

    if (!coValueRow.rows[0]) {
      return undefined;
    }

    const rowId = coValueRow.rows[0].rowID || coValueRow.rows[0].rowid;
    const sessions = await this.db.query(
      'SELECT "sessionID", "lastIdx" FROM sessions WHERE "coValue" = $1',
      [rowId]
    );

    const knownState = emptyKnownState(coValueId);
    knownState.header = true;

    for (const session of sessions.rows) {
      const sessionID = session.sessionID || session.sessionid;
      const lastIdx = session.lastIdx || session.lastidx;
      knownState.sessions[sessionID] = lastIdx;
    }

    return knownState;
  }
}

/**
 * Create PGlite adapter with migrations
 */
export async function createPGliteAdapter(dbPath) {
  const db = new PGlite(dbPath);
  
  // Run migrations
  await runMigrations(db);
  
  return new PGliteClient(db);
}
