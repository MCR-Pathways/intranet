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

async function checkSchemaHealth() {
  console.log('Checking database schema health...\n');

  const checks = [];

  // Check if required types exist
  const requiredTypes = ['user_type', 'user_status', 'leave_type', 'leave_status'];
  for (const typeName of requiredTypes) {
    try {
      const result = await sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = ${typeName}
        ) as exists
      `;
      const exists = result[0]?.exists;
      checks.push({ name: `Type: ${typeName}`, exists });
    } catch (error) {
      checks.push({ name: `Type: ${typeName}`, exists: false, error: error.message });
    }
  }

  // Check if required tables exist
  const requiredTables = ['profiles', 'teams', 'notifications', 'manager_teams'];
  for (const tableName of requiredTables) {
    try {
      const result = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = ${tableName}
        ) as exists
      `;
      const exists = result[0]?.exists;
      checks.push({ name: `Table: ${tableName}`, exists });
    } catch (error) {
      checks.push({ name: `Table: ${tableName}`, exists: false, error: error.message });
    }
  }

  // Check if the handle_new_user trigger exists
  try {
    const result = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
      ) as exists
    `;
    checks.push({ name: 'Trigger: on_auth_user_created', exists: result[0]?.exists });
  } catch (error) {
    checks.push({ name: 'Trigger: on_auth_user_created', exists: false, error: error.message });
  }

  console.log('Schema Health Report:');
  console.log('=====================');
  let allHealthy = true;
  for (const check of checks) {
    const status = check.exists ? '✓' : '✗';
    console.log(`${status} ${check.name}`);
    if (check.error) {
      console.log(`  Error: ${check.error}`);
    }
    if (!check.exists) allHealthy = false;
  }
  console.log('');

  return allHealthy;
}

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
      // Check if it's a "already exists" error which we can safely ignore
      // for idempotent migrations
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
        console.log(`⚠ ${migration} - some objects already exist (continuing)\n`);
      } else {
        console.error(`✗ ${migration} failed:`);
        console.error(error.message);
        console.error('\nTip: If the error mentions missing types or tables,');
        console.error('try running the combined migration in Supabase SQL Editor:');
        console.error('supabase/migrations/combined_migration.sql\n');
        process.exit(1);
      }
    }
  }

  console.log('All migrations completed!\n');

  // Verify schema health after migrations
  const isHealthy = await checkSchemaHealth();

  if (isHealthy) {
    console.log('✓ Database schema is healthy and ready for use!\n');
  } else {
    console.log('⚠ Some schema elements are missing. Please review the report above.\n');
  }

  await sql.end();
}

// Check for --check-only flag
const checkOnly = process.argv.includes('--check-only');

if (checkOnly) {
  checkSchemaHealth()
    .then(healthy => {
      sql.end();
      process.exit(healthy ? 0 : 1);
    })
    .catch(err => {
      console.error('Error checking schema:', err.message);
      sql.end();
      process.exit(1);
    });
} else {
  runMigrations();
}
