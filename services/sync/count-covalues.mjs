#!/usr/bin/env bun
import { createPGliteAdapter } from '@MaiaOS/storage/adapters/pglite.js'

const dbPath = process.env.PEER_DB_PATH || './services/sync/pg-lite.db'
const client = await createPGliteAdapter(dbPath)

const total = await client.db.query('SELECT COUNT(*)::int AS count FROM covalues')
console.log('\n=== TOTAL coValues:', total.rows[0]?.count, '===\n')

const byType = await client.db.query(`
  SELECT 
    COALESCE(header::json->'meta'->>'type', 'none') as ruleset_type,
    COUNT(*)::int as count
  FROM covalues
  GROUP BY ruleset_type
  ORDER BY count DESC
`)
console.log('--- By header.meta.type ---')
for (const r of byType.rows) console.log(`  ${r.ruleset_type}: ${r.count}`)

const byFactory = await client.db.query(`
  SELECT 
    COALESCE(
      CASE 
        WHEN header::json->'meta'->>'$factory' LIKE 'co_z%' THEN header::json->'meta'->>'$factory'
        ELSE header::json->'meta'->>'$factory'
      END,
      'no-factory'
    ) as factory,
    COUNT(*)::int as count
  FROM covalues
  GROUP BY factory
  ORDER BY count DESC
`)
console.log('\n--- By header.meta.$factory ---')
for (const r of byFactory.rows) console.log(`  ${r.factory}: ${r.count}`)

const byRuleset = await client.db.query(`
  SELECT 
    COALESCE(header::json->'ruleset'->>'type', 'unknown') as ruleset,
    COUNT(*)::int as count
  FROM covalues
  GROUP BY ruleset
  ORDER BY count DESC
`)
console.log('\n--- By header.ruleset.type ---')
for (const r of byRuleset.rows) console.log(`  ${r.ruleset}: ${r.count}`)

const groups = await client.db.query(`
  SELECT COUNT(*)::int as count FROM covalues 
  WHERE header::json->'ruleset'->>'type' = 'group'
`)
const nonGroups = await client.db.query(`
  SELECT COUNT(*)::int as count FROM covalues 
  WHERE header::json->'ruleset'->>'type' != 'group' OR header::json->'ruleset'->>'type' IS NULL
`)
console.log('\n--- Groups vs Content ---')
console.log(`  Groups: ${groups.rows[0]?.count}`)
console.log(`  Non-groups: ${nonGroups.rows[0]?.count}`)

const sessions = await client.db.query('SELECT COUNT(*)::int as count FROM sessions')
const transactions = await client.db.query('SELECT COUNT(*)::int as count FROM transactions')
console.log('\n--- Related tables ---')
console.log(`  Sessions: ${sessions.rows[0]?.count}`)
console.log(`  Transactions: ${transactions.rows[0]?.count}`)

// Build co-id -> title map: scan ALL transactions for "title" keys
const allTxWithTitle = await client.db.query(`
  SELECT c.id, t.tx
  FROM covalues c
  JOIN sessions s ON s."coValue" = c."rowID"
  JOIN transactions t ON t.ses = s."rowID"
  WHERE t.tx LIKE '%title%'
  ORDER BY c.id, t.idx
`)
const coIdToTitle = new Map()
for (const row of allTxWithTitle.rows) {
  try {
    const parsed = JSON.parse(row.tx)
    if (Array.isArray(parsed)) {
      for (let i = 0; i < parsed.length - 1; i++) {
        if (parsed[i] === 'title' && typeof parsed[i+1] === 'string') {
          coIdToTitle.set(row.id, parsed[i+1])
          break
        }
      }
    }
  } catch {}
}

console.log('\n--- Factory co-id to name resolution (sorted by count) ---')
for (const r of byFactory.rows) {
  if (r.factory?.startsWith('co_z')) {
    const name = coIdToTitle.get(r.factory) || '(unresolved)'
    console.log(`  [${r.count}] ${name} (${r.factory})`)
  } else {
    console.log(`  [${r.count}] ${r.factory}`)
  }
}

// Summary: count by category
const categoryMap = new Map()
for (const r of byFactory.rows) {
  const name = r.factory?.startsWith('co_z') ? (coIdToTitle.get(r.factory) || 'unresolved') : r.factory
  let cat = 'other'
  if (name === 'no-factory') cat = 'groups (no factory)'
  else if (name === '@metaSchema') cat = 'metaSchema bootstrap'
  else if (name === 'ProfileFactory') cat = 'cojson internal'
  else if (name.includes('index/')) cat = 'index schemas + colists'
  else if (name.includes('°maia/factory/')) cat = 'factory schema instances'
  else if (name === 'unresolved') cat = 'unresolved'
  else cat = name
  categoryMap.set(cat, (categoryMap.get(cat) || 0) + r.count)
}
console.log('\n--- Summarized categories ---')
for (const [cat, count] of [...categoryMap.entries()].sort((a,b) => b[1] - a[1])) {
  console.log(`  [${count}] ${cat}`)
}

await client.close?.()
