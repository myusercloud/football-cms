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

async function migrate() {
  console.log('Connecting to databases...')
  const sqlite = new Database(SQLITE_PATH, { readonly: true })
  const pg = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await pg.connect()
  console.log('Connected.\n')

  // Verify Strapi has already created the PG schema
  const schemaCheck = await pg.query(
    "SELECT 1 FROM information_schema.tables WHERE table_name = 'strapi_core_store_settings' AND table_schema = 'public'"
  )
  if (!schemaCheck.rows.length) {
    console.error('PostgreSQL schema not found. You must start Strapi on PostgreSQL first:')
    console.error('  1. Ensure DATABASE_CLIENT=postgres in .env')
    console.error('  2. Run: npm run develop')
    console.error('  3. Wait for "Server started" message, then stop it (Ctrl+C)')
    console.error('  4. Re-run this script')
    await pg.end()
    sqlite.close()
    process.exit(1)
  }

  // Fetch all PG column types so we can convert SQLite values correctly
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

  // All SQLite tables except the internal sequence table
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence' ORDER BY name")
    .all()
    .map(t => t.name)

  // Disable FK constraint checks for the duration of the migration
  await pg.query('SET session_replication_role = replica')

  let totalRows = 0

  for (const table of tables) {
    if (!pgSchema[table]) {
      console.log(`  skip  ${table}  (not in PG schema)`)
      continue
    }

    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all()
    if (!rows.length) {
      console.log(`  empty ${table}`)
      continue
    }

    // Wipe any data Strapi auto-created (e.g. admin user bootstrap)
    await pg.query(`TRUNCATE TABLE "${table}" CASCADE`)

    const colTypes = pgSchema[table]
    let inserted = 0
    let errors = 0

    for (const row of rows) {
      // Only include columns that exist in PG schema
      const cols = Object.keys(row).filter(c => c in colTypes)
      if (!cols.length) continue

      const values = cols.map(col => {
        const val = row[col]
        if (val === null || val === undefined) return null
        const type = colTypes[col]

        // SQLite stores booleans as 0/1 integers
        if (type === 'boolean') return val === 1 || val === true

        // SQLite stores Strapi datetimes as millisecond epoch integers
        if (
          (type === 'timestamp with time zone' || type === 'timestamp without time zone') &&
          typeof val === 'number'
        ) return new Date(val).toISOString()

        // SQLite stores JSON as serialized strings
        if (type === 'jsonb' && typeof val === 'string') {
          try { return JSON.parse(val) } catch { return val }
        }

        return val
      })

      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
      const colNames = cols.map(c => `"${c}"`).join(', ')

      try {
        await pg.query(`INSERT INTO "${table}" (${colNames}) VALUES (${placeholders})`, values)
        inserted++
      } catch (err) {
        errors++
        if (errors <= 3) {
          console.error(`  [${table}] insert error: ${err.message}`)
        }
      }
    }

    totalRows += inserted
    const status = errors ? ` (${errors} errors)` : ''
    console.log(`  ✓  ${table.padEnd(48)} ${inserted} rows${status}`)
  }

  // Reset all PG sequences to be above the highest migrated ID
  const seqResult = await pg.query(
    "SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'"
  )
  for (const { sequencename } of seqResult.rows) {
    // Sequence names follow the pattern <table>_id_seq
    const tableName = sequencename.replace(/_id_seq$/, '')
    try {
      await pg.query(`
        SELECT setval('${sequencename}',
          COALESCE((SELECT MAX(id) FROM "${tableName}"), 1), true
        )
      `)
    } catch {
      // Table may not have an id column — skip silently
    }
  }

  // Re-enable FK constraints
  await pg.query('SET session_replication_role = DEFAULT')

  console.log(`\nDone — ${totalRows} rows migrated to PostgreSQL.`)
  console.log('You can now start Strapi: npm run develop')

  await pg.end()
  sqlite.close()
}

migrate().catch(err => {
  console.error('\nMigration failed:', err.message)
  process.exit(1)
})
