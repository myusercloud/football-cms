/**
 * SQLite → PostgreSQL migration script
 *
 * Run AFTER Strapi has started once with DATABASE_CLIENT=postgres
 * (so it creates the PG schema), then been stopped.
 *
 * Usage:
 *   node scripts/migrate-to-postgres.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const Database = require('better-sqlite3')
const { Client } = require('pg')
const path = require('path')

const SQLITE_PATH = path.join(__dirname, '../.tmp/data.db')
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set in .env')
  process.exit(1)
}

// These tables are schema-version metadata — Strapi already wrote the
// correct values when it initialised the PG database. Overwriting them
// with SQLite values would confuse Strapi's migration runner.
const SKIP_TABLES = new Set([
  'strapi_migrations_internal',
  'strapi_database_schema',
  'strapi_sessions',       // transient auth sessions — users re-login after migration
  'sqlite_sequence',
])

function convertValue(val, pgType) {
  if (val === null || val === undefined) return null

  // SQLite stores booleans as 0 / 1
  if (pgType === 'boolean') return val === 1 || val === true

  // SQLite stores Strapi datetimes as millisecond epoch integers
  if (
    (pgType === 'timestamp with time zone' || pgType === 'timestamp without time zone') &&
    typeof val === 'number'
  ) return new Date(val).toISOString()

  // SQLite stores JSON columns as serialised strings.
  // Handle both 'json' and 'jsonb' PG types; empty string must become null.
  // IMPORTANT: pass the raw string, not a parsed JS object. The pg driver converts
  // JS arrays to PostgreSQL array syntax ({"a","b"}) instead of JSON (["a","b"]),
  // which causes "invalid input syntax for type json". PostgreSQL accepts JSON strings
  // natively as input to json/jsonb columns, so passing the raw string is correct.
  if ((pgType === 'jsonb' || pgType === 'json') && typeof val === 'string') {
    if (val === '') return null
    try { JSON.parse(val); return val } catch { return null }
  }

  return val
}

async function migrate() {
  console.log('Connecting to databases...')
  const sqlite = new Database(SQLITE_PATH, { readonly: true })
  const pg = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await pg.connect()
  console.log('Connected.\n')

  // Verify Strapi has already initialised the PG schema
  const schemaCheck = await pg.query(
    "SELECT 1 FROM information_schema.tables WHERE table_name = 'strapi_core_store_settings' AND table_schema = 'public'"
  )
  if (!schemaCheck.rows.length) {
    console.error('PostgreSQL schema not found. Please:')
    console.error('  1. Ensure DATABASE_CLIENT=postgres in .env')
    console.error('  2. Run: npm run develop')
    console.error('  3. Wait for "Server started" then stop it (Ctrl+C)')
    console.error('  4. Re-run this script')
    await pg.end(); sqlite.close(); process.exit(1)
  }

  // Fetch all PG column type metadata
  const colResult = await pg.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `)
  const pgSchema = {}
  for (const row of colResult.rows) {
    if (!pgSchema[row.table_name]) pgSchema[row.table_name] = {}
    pgSchema[row.table_name][row.column_name] = row.data_type
  }

  // Partition tables: link/junction tables last so FK constraints are satisfied
  const allTables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map(t => t.name)
    .filter(t => !SKIP_TABLES.has(t) && pgSchema[t])

  const linkTables    = allTables.filter(t => t.endsWith('_lnk') || t.endsWith('_mph'))
  const contentTables = allTables.filter(t => !t.endsWith('_lnk') && !t.endsWith('_mph'))

  // ── Clear existing PG data ────────────────────────────────────────────────
  // Delete link tables first (they hold the FK references), then content.
  // Use DELETE (not TRUNCATE) — no superuser required.
  console.log('Clearing existing PostgreSQL data...')
  for (const table of [...linkTables, ...contentTables]) {
    try {
      await pg.query(`DELETE FROM "${table}"`)
    } catch (err) {
      console.warn(`  warn: could not clear ${table}: ${err.message}`)
    }
  }

  // ── Insert migrated data ──────────────────────────────────────────────────
  // Content tables first, link tables last — satisfies FK constraints.
  console.log('\nMigrating rows...')
  let totalRows = 0

  for (const table of [...contentTables, ...linkTables]) {
    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all()
    if (!rows.length) continue

    const colTypes = pgSchema[table]
    let inserted = 0
    let errors = 0

    for (const row of rows) {
      const cols = Object.keys(row).filter(c => c in colTypes)
      if (!cols.length) continue

      const values   = cols.map(col => convertValue(row[col], colTypes[col]))
      const colNames = cols.map(c => `"${c}"`).join(', ')
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')

      try {
        await pg.query(`INSERT INTO "${table}" (${colNames}) VALUES (${placeholders})`, values)
        inserted++
      } catch (err) {
        errors++
        if (errors <= 2) console.error(`  [${table}] row error: ${err.message}`)
      }
    }

    totalRows += inserted
    const tag = errors ? ` (${errors} errors)` : ''
    if (inserted > 0) console.log(`  ✓  ${table.padEnd(48)} ${inserted} rows${tag}`)
  }

  // ── Reset sequences ───────────────────────────────────────────────────────
  const seqResult = await pg.query(
    "SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'"
  )
  for (const { sequencename } of seqResult.rows) {
    const tableName = sequencename.replace(/_id_seq$/, '')
    try {
      await pg.query(`
        SELECT setval('${sequencename}',
          COALESCE((SELECT MAX(id) FROM "${tableName}"), 1), true
        )
      `)
    } catch { /* table has no id column — skip */ }
  }

  console.log(`\nDone — ${totalRows} rows migrated.`)
  console.log('Start Strapi: npm run develop')

  await pg.end()
  sqlite.close()
}

migrate().catch(err => {
  console.error('\nMigration failed:', err.message)
  process.exit(1)
})
