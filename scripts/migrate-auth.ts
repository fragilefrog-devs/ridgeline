import { Client } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Simple secure hash helper using PBKDF2 with salt
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  console.log('Creating public.users table in Neon Lakebase Postgres...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'owner',
      organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
      onboarding_completed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
    CREATE INDEX IF NOT EXISTS idx_users_org ON public.users (organization_id);

    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Tenant isolation for users" ON public.users;
    CREATE POLICY "Tenant isolation for users"
      ON public.users FOR ALL
      USING (organization_id = app.current_organization_id() OR id = app.current_user_id())
      WITH CHECK (organization_id = app.current_organization_id() OR id = app.current_user_id());
  `);

  // Check if primary demo user exists
  const existing = await client.query(`SELECT id FROM public.users WHERE email = 'mark@apexplumbingpro.com';`);
  if (existing.rows.length === 0) {
    const orgRes = await client.query(`SELECT id FROM public.organizations LIMIT 1;`);
    const orgId = orgRes.rows[0]?.id;
    const defaultHash = hashPassword('Password123!');

    await client.query(`
      INSERT INTO public.users (email, password_hash, full_name, role, organization_id, onboarding_completed)
      VALUES ($1, $2, $3, $4, $5, $6);
    `, ['mark@apexplumbingpro.com', defaultHash, 'Mark Kowalski', 'owner', orgId, true]);
    console.log('Seeded primary user: mark@apexplumbingpro.com / Password123!');
  } else {
    console.log('Primary demo user already exists.');
  }

  const count = await client.query(`SELECT count(*) FROM public.users;`);
  console.log('Users in Neon database:', count.rows[0].count);

  await client.end();
}

run().catch(err => {
  console.error('Auth migration failed:', err);
  process.exit(1);
});
