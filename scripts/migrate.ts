import { Client } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set in environment!');
  process.exit(1);
}

async function runMigration() {
  console.log('Connecting to Neon Lakebase Postgres...');
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // Create app schema, functions, and tenant role if not already present
    await client.query('CREATE SCHEMA IF NOT EXISTS app;');
    await client.query(`
      CREATE OR REPLACE FUNCTION app.current_organization_id() RETURNS UUID AS $$
      BEGIN
        RETURN NULLIF(current_setting('app.current_organization_id', true), '')::UUID;
      EXCEPTION
        WHEN OTHERS THEN RETURN NULL;
      END;
      $$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

      CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS UUID AS $$
      BEGIN
        RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
      EXCEPTION
        WHEN OTHERS THEN RETURN NULL;
      END;
      $$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

      DO $$ BEGIN
        CREATE ROLE ridgeline_app WITH NOLOGIN;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260927000000_init_ridgeline_schema.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing schema migration...');
    await client.query(migrationContent);
    console.log('Migration successfully applied to Neon Lakebase Postgres!');

    // Verify tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Created tables:', tablesRes.rows.map((r: any) => r.table_name));

    const orgCount = await client.query('SELECT count(*) FROM public.organizations;');
    console.log('Organizations count:', orgCount.rows[0].count);

    const bookingsCount = await client.query('SELECT count(*) FROM public.job_bookings;');
    console.log('Bookings count:', bookingsCount.rows[0].count);
  } finally {
    await client.end();
  }
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
