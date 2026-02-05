import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Supabase database connection string
// Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  console.log('\nTo find your database URL:');
  console.log('1. Go to https://supabase.com/dashboard/project/eapnkclguiogyatmntze/settings/database');
  console.log('2. Copy the "Connection string" (URI format)');
  console.log('3. Run: DATABASE_URL="your-connection-string" node scripts/run-migrations.mjs');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  ssl: 'require',
});

const migrations = [
  '00001_create_enums.sql',
  '00002_create_core_tables.sql',
  '00003_create_rls_policies.sql',
];

async function runMigrations() {
  console.log('Starting migrations...\n');

  for (const migration of migrations) {
    const filePath = join(__dirname, '..', 'supabase', 'migrations', migration);
    console.log(`Running: ${migration}`);

    try {
      const sqlContent = readFileSync(filePath, 'utf8');
      await sql.unsafe(sqlContent);
      console.log(`✓ ${migration} completed\n`);
    } catch (error) {
      console.error(`✗ ${migration} failed:`);
      console.error(error.message);
      process.exit(1);
    }
  }

  console.log('All migrations completed successfully!');
  await sql.end();
}

runMigrations();
