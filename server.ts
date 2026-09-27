import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { Pool, PoolClient } from '@neondatabase/serverless';
import fs from 'fs';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';

// Load both .env.local and .env
dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Hosts (Render, Heroku, PaaS) inject a dynamic port via PORT, so honour it and keep 3000 as the local-dev fallback.
const injectedPort = Number(process.env.PORT);
const PORT = Number.isInteger(injectedPort) && injectedPort > 0 && injectedPort <= 65535 ? injectedPort : 3000;

const COOKIE_NAME = 'ridgeline_session';

// Session-signing secret resolution.
//
// A committed literal fallback is a forge-everyone's-session vulnerability: the
// value is public, so anyone can mint a JWT for an arbitrary userId /
// organizationId. So there are no literal fallbacks at all — only two options:
//
//   production      -> refuse to start, naming every missing variable
//   dev / test      -> a fresh random value per process (sessions die on restart,
//                      which is the correct trade for a dev machine)
//
// This runs at module scope, before any route is registered and long before
// startServer() binds a port, so a misconfigured deploy fails fast and loudly
// instead of coming up and serving forgeable sessions.
function resolveSigningSecrets(): { jwtSecret: string; cookieSecret: string } {
  const envJwt = process.env.JWT_SECRET;
  const envSession = process.env.SESSION_SECRET;
  const envCookie = process.env.COOKIE_SECRET;

  // Precedence is unchanged: JWT_SECRET wins, SESSION_SECRET is the alias.
  // `|| ''` (not a trim) so the value is used exactly as provided.
  const configuredJwtSecret = envJwt || envSession || '';
  const configuredCookieSecret = envCookie || '';

  if (process.env.NODE_ENV === 'production') {
    const missing: string[] = [];
    if (!configuredJwtSecret) {
      // Both spellings are acceptable but at least one must be present.
      missing.push('JWT_SECRET (or SESSION_SECRET)');
    }
    if (!configuredCookieSecret) missing.push('COOKIE_SECRET');
    if (missing.length > 0) {
      throw new Error(
        `FATAL: refusing to start in production with no signing secret configured.\n` +
        `Missing environment variable(s): ${missing.join(', ')}\n` +
        `Set them to high-entropy random values (e.g. \`openssl rand -hex 32\`).\n` +
        `Refusing to fall back to any built-in value: a hardcoded signing secret in ` +
        `source control lets anyone forge a session token for any user or organization.`
      );
    }
    return { jwtSecret: configuredJwtSecret, cookieSecret: configuredCookieSecret };
  }

  // Non-production: random per process, never a constant. Warn loudly, because
  // "my sessions keep logging me out" is otherwise a confusing symptom.
  const ephemeralJwtSecret = configuredJwtSecret || crypto.randomBytes(32).toString('hex');
  const ephemeralCookieSecret = configuredCookieSecret || crypto.randomBytes(32).toString('hex');
  if (!configuredJwtSecret || !configuredCookieSecret) {
    console.warn(
      '[SECURITY WARNING] Using EPHEMERAL, PER-PROCESS random signing secrets because ' +
      `${!configuredJwtSecret ? 'JWT_SECRET/SESSION_SECRET' : ''}${!configuredJwtSecret && !configuredCookieSecret ? ' and ' : ''}` +
      `${!configuredCookieSecret ? 'COOKIE_SECRET' : ''} is not set. ` +
      'These are regenerated on every restart, so all existing sessions/cookies are invalidated. ' +
      'This is fine for local dev and MUST NOT be relied on for any shared or deployed environment.'
    );
  }
  return { jwtSecret: ephemeralJwtSecret, cookieSecret: ephemeralCookieSecret };
}

const { jwtSecret: JWT_SECRET, cookieSecret: COOKIE_SECRET } = resolveSigningSecrets();

// Twilio Telephony & SMS Configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+15557824309';
const FORWARD_CALLS_TO = process.env.FORWARD_CALLS_TO || '+15551234567';

const twilioClient = (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN)
  ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  : null;

const { MessagingResponse, VoiceResponse } = twilio.twiml;

// Scoped body parser specifically for Twilio webhooks (application/x-www-form-urlencoded)
const twilioFormParser = express.urlencoded({ extended: false });

// Twilio Webhook HMAC-SHA1 Signature Verification Middleware
function verifyTwilioSignature(req: Request, res: Response, next: NextFunction) {
  if (!TWILIO_AUTH_TOKEN) {
    if (process.env.NODE_ENV === 'production') {
      console.error('TWILIO_AUTH_TOKEN not set — rejecting webhook in production');
      return res.status(500).send('Server misconfigured: TWILIO_AUTH_TOKEN required');
    } else {
      console.warn('TWILIO_AUTH_TOKEN not set — bypassing webhook verification for development testing');
      return next();
    }
  }

  const signature = req.header('X-Twilio-Signature') || '';

  // Build the exact URL Twilio used to sign the request.
  // Prefer a fixed APP_URL over trusting proxy headers.
  const base = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  const fullUrl = `${base}${req.originalUrl}`;

  const isValid = twilio.validateRequest(
    TWILIO_AUTH_TOKEN,
    signature,
    fullUrl,
    req.body // must be the parsed x-www-form-urlencoded params, not raw JSON
  );

  if (!isValid) {
    console.warn('Rejected webhook: invalid Twilio signature', { fullUrl, signaturePresent: !!signature });
    return res.status(403).send('Invalid signature');
  }

  next();
}

app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));

// Initialize Google GenAI client if API key is present
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Initialize Neon Postgres Pool
const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
let pool: Pool | null = null;

if (dbUrl) {
  try {
    pool = new Pool({ connectionString: dbUrl });
    console.log('Neon Lakebase Postgres pool initialized');
  } catch (err) {
    console.error('Failed to initialize Neon pool:', err);
  }
}

// System instruction for RidgeLine Trade Assistant
const RIDGELINE_SYSTEM_PROMPT = `You are "RidgeLine", an intelligent SMS scheduling and dispatch assistant representing a solo licensed tradesperson (plumber, electrician, or HVAC technician).
The tradesperson is actively on tools (under a sink, in an attic, or in a trench) and cannot text or answer calls.

Your job:
1. Handle incoming customer SMS text messages warmly, concisely, and decisively. Sound like a helpful human assistant or the owner's dedicated dispatcher (not a robotic corporate chatbot).
2. Triage urgency:
   - "emergency": Active flooding, sewage backup, carbon monoxide, no heat in winter, sparking electrical. Advise immediate safety steps (e.g. "please shut off the main water valve clockwise") and prioritize immediate scheduling.
   - "urgent": Major inconvenience (e.g., sole toilet clogged, water heater pilot out).
   - "routine": Maintenance, faucet replacements, EV chargers, quotes.
3. Handle bookings:
   - Identify service needed and match with service catalog.
   - Propose 1-2 concrete time slots.
   - Collect address if not provided.
   - Auto-confirm when client agrees to a slot.
4. Handle reschedules:
   - Parse natural language reschedule requests (e.g. "push to Thursday morning", "can we do 4pm instead?").
   - Offer the new slot and confirm update.
5. Tone: Short, helpful text messages (1 to 3 sentences max, suitable for SMS). Keep sentences crisp. Never write long multi-paragraph essays.`;

// Default OpenAI-compatible endpoint settings (e.g. 9router, LiteLLM, vLLM, Ollama)
const DEFAULT_OPENAI_BASE_URL = process.env.OPENAI_COMPATIBLE_BASE_URL || 'https://9router-production-a99a.up.railway.app/v1';
// Empty-string (not undefined) so the truthiness-based provider-selection chain
// below degrades cleanly to Gemini and then the deterministic responder when
// OPENAI_COMPATIBLE_API_KEY is unset, instead of attempting a request with a
// missing key.
const DEFAULT_OPENAI_API_KEY = process.env.OPENAI_COMPATIBLE_API_KEY || '';
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_COMPATIBLE_MODEL || 'gemini/gemini-3.8-flash';

// Helper to call OpenAI-compatible chat completions endpoint with json output
async function callOpenAiCompatibleChat(options: {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
}): Promise<string> {
  const baseUrl = (options.baseUrl || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, '');
  const apiKey = options.apiKey || DEFAULT_OPENAI_API_KEY;
  const model = options.model || DEFAULT_OPENAI_MODEL;

  // Refuse to call out with an empty bearer token. `llmProvider` is hydrated as
  // 'openai_compatible' by default (see assistant_settings load), so this branch
  // is reachable with no key configured; sending `Authorization: Bearer ` would
  // spend a doomed round-trip on a guaranteed 401. Throwing lets the caller's
  // existing catch hand off to Gemini and then the deterministic responder.
  if (!apiKey) {
    throw new Error('OpenAI-compatible API key is not configured');
  }

  const url = `${baseUrl}/chat/completions`;
  const body: any = {
    model,
    messages: [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: options.userPrompt },
    ],
    temperature: 0.2,
  };

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI-compatible API error (${response.status}): ${errText}`);
  }

  const text = await response.text();

  // Handle both standard JSON responses and SSE streams if returned
  try {
    const json = JSON.parse(text);
    return json.choices?.[0]?.message?.content || '';
  } catch (e) {
    // Check if response is Server-Sent Events (data: {...})
    if (text.includes('data:')) {
      let accumulatedContent = '';
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:') && !trimmed.includes('[DONE]')) {
          const chunkStr = trimmed.slice(5).trim();
          try {
            const chunk = JSON.parse(chunkStr);
            const delta = chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.message?.content || '';
            accumulatedContent += delta;
          } catch (err) {
            // continue
          }
        }
      }
      if (accumulatedContent) return accumulatedContent;
    }
    return text;
  }
}

// ==========================================
// AUTHENTICATION & SECURITY (SESSION JWT & RLS)
// ==========================================

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  organizationId: string;
  onboardingCompleted: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

interface SessionPayload {
  userId: string;
  email: string;
  organizationId: string;
  role: string;
}

function createSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch (err) {
    return null;
  }
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
}

// ==========================================
// PASSWORD HASHING (PBKDF2-SHA512, versioned)
// ==========================================
//
// The historical format was a bare `${saltHex}:${hashHex}` at 1,000 iterations
// and carried no cost metadata, so the iteration count could not be raised
// without invalidating every existing password. The new format encodes it:
//
//   pbkdf2-sha512$<iterations>$<saltHex>$<hashHex>
//
// Verification is backwards compatible: a legacy `salt:hash` string is still
// checked at the legacy cost of 1,000, and on success the caller is told it
// needs re-hashing so the stored value is transparently upgraded on first
// login. All hashing and verification MUST go through these helpers so the
// formats can never drift apart.
const PBKDF2_ALGORITHM = 'sha512';
const PBKDF2_KEYLEN = 64;
// 16 bytes of salt — unchanged from the legacy implementation on purpose.
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_PREFIX = 'pbkdf2-sha512';
// OWASP guidance for PBKDF2-HMAC-SHA512.
const PBKDF2_ITERATIONS = 210_000;
// Cost baked into every pre-migration hash, used to verify legacy rows.
const PBKDF2_LEGACY_ITERATIONS = 1_000;

function pbkdf2Hex(password: string, saltHex: string, iterations: number): string {
  return crypto.pbkdf2Sync(password, saltHex, iterations, PBKDF2_KEYLEN, PBKDF2_ALGORITHM).toString('hex');
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(PBKDF2_SALT_BYTES).toString('hex');
  const hash = pbkdf2Hex(password, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

/**
 * Verify a password against either stored format.
 * Returns whether the password matched, and whether the stored value is
 * legacy and should be replaced with a fresh hash at the current cost.
 */
function verifyPasswordDetailed(password: string, storedHash: string): { valid: boolean; needsRehash: boolean } {
  if (!storedHash) return { valid: false, needsRehash: false };

  if (storedHash.startsWith(`${PBKDF2_PREFIX}$`)) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return { valid: false, needsRehash: false };
    const iterations = Number(parts[1]);
    const [, , salt, expected] = parts;
    if (!Number.isInteger(iterations) || iterations < 1 || !salt || !expected) {
      return { valid: false, needsRehash: false };
    }
    const valid = pbkdf2Hex(password, salt, iterations) === expected;
    // A correct password stored at an outdated cost still gets upgraded.
    return { valid, needsRehash: valid && iterations !== PBKDF2_ITERATIONS };
  }

  // Legacy `salt:hash` — verify at the legacy cost, then flag for upgrade.
  const legacyParts = storedHash.split(':');
  if (legacyParts.length !== 2) return { valid: false, needsRehash: false };
  const [salt, expected] = legacyParts;
  const valid = pbkdf2Hex(password, salt, PBKDF2_LEGACY_ITERATIONS) === expected;
  return { valid, needsRehash: valid };
}

function verifyPassword(password: string, storedHash: string): boolean {
  return verifyPasswordDetailed(password, storedHash).valid;
}

// UUID validation and deterministic mapping helper for Postgres UUID fields
function isValidUuid(id: any): boolean {
  if (typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function toUuid(input?: any): string {
  if (!input) return crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-0000-0000-000000000000';
  if (isValidUuid(input)) return input;
  const hash = crypto.createHash('md5').update('ridgeline:' + String(input)).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

// In-Memory Multi-Tenant Store for standalone/preview environment
const inMemoryOrgs: any[] = [
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    name: 'Apex Plumbing & Mechanical',
    trade: 'plumbing',
    technicianName: 'Mark Kowalski',
    plan: 'Solo Pro',
    twilioPhoneNumber: '+1 (555) 782-4309',
    forwardCallsTo: '+1 (555) 438-9210',
    licenseNumber: 'CA-PLUMB-982104',
    serviceRadiusMiles: 30,
    businessAddress: '104 Industrial Way, Suite B, Springfield',
    email: 'dispatch@apexplumbingpro.com',
  }
];

const inMemoryUsers: any[] = [
  {
    id: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    email: 'mark@apexplumbingpro.com',
    passwordHash: '73934371fa7ba4ad2fb2df3db275e533:f9ea343a4e9b94098492025256e2974fa214309a47d2f9b8c0953a7f80879a95764d95b54203ad6f73111fdb8542fc3a4df44c1ee0085ef19de172e276f7c9e0',
    fullName: 'Mark Kowalski',
    role: 'owner',
    organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    onboardingCompleted: true,
  }
];

const inMemorySettings: Record<string, any> = {
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11': {
    tradespersonName: 'Mark Kowalski',
    businessName: 'Apex Plumbing & Mechanical',
    tradeType: 'plumbing',
    twilioPhoneNumber: '+1 (555) 782-4309',
    forwardCallsTo: '+1 (555) 438-9210',
    aiTone: 'friendly_direct',
    autoConfirmRoutine: true,
    bufferMinutesBetweenJobs: 45,
    workingHours: { start: '07:30', end: '17:30', workWeekends: false },
    emergencyKeywords: ['flood', 'burst', 'leak', 'spark', 'smoke', 'sewage'],
  }
};

const inMemoryServices: any[] = [
  { id: 'b1111111-1111-1111-1111-111111111111', organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', title: 'Water Heater Replacement / Diagnostic', trade: 'plumbing', durationHours: 2.5, totalPrice: 420.00, basePrice: 420.00, description: 'Diagnose pilot assembly, heating elements, or full 50-gal tank replacement installation.', isPopular: true },
  { id: 'b2222222-2222-2222-2222-222222222222', organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', title: 'Main Line Drain Snaking / Hydrojet', trade: 'plumbing', durationHours: 1.5, totalPrice: 285.00, basePrice: 285.00, description: 'Camera inspection + heavy duty 100ft snake rooter for slow or backed-up main sewer cleanout.', isPopular: true },
  { id: 'b3333333-3333-3333-3333-333333333333', organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', title: 'Emergency Burst Pipe & Valve Shutoff', trade: 'plumbing', durationHours: 2.0, totalPrice: 380.00, basePrice: 380.00, description: 'Immediate dispatch for active interior leaks, broken copper/PEX fittings, and pressure relief failures.', isPopular: true },
  { id: 'b4444444-4444-4444-4444-444444444444', organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', title: 'Garbage Disposal & Kitchen Faucet Swap', trade: 'plumbing', durationHours: 1.0, totalPrice: 195.00, basePrice: 195.00, description: 'Replacement of jammed 1/2 HP Badger or leaky pull-down kitchen faucet assembly.', isPopular: false }
];

const inMemoryBookings: any[] = [
  { id: 'd1111111-1111-1111-1111-111111111111', organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', customerName: 'Elena Rostova', customerPhone: '+1 (555) 234-8901', address: '742 Evergreen Terrace, Springfield', tradeType: 'plumbing', serviceTitle: 'Main Line Drain Snaking / Hydrojet', scheduledDate: new Date().toISOString().slice(0, 10), timeSlot: '08:30 AM - 10:30 AM', status: 'completed', estimateAmount: 285, notes: 'Downstairs bathroom shower backing up.', urgency: 'urgent', createdFrom: 'sms', createdAt: new Date().toISOString() },
  { id: 'd2222222-2222-2222-2222-222222222222', organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', customerName: 'Marcus Vance', customerPhone: '+1 (555) 349-1122', address: '1840 Highland Ridge Dr, Westview', tradeType: 'plumbing', serviceTitle: 'Water Heater Replacement / Diagnostic', scheduledDate: new Date().toISOString().slice(0, 10), timeSlot: '11:15 AM - 01:45 PM', status: 'in_progress', estimateAmount: 650, notes: 'Rheem 50-gal water heater leaking.', urgency: 'routine', createdFrom: 'missed_call', createdAt: new Date().toISOString() }
];

const inMemoryThreads: any[] = [
  { id: 'c1111111-1111-1111-1111-111111111111', organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', customerName: 'Elena Rostova', customerPhone: '+1 (555) 234-8901', address: '742 Evergreen Terrace, Springfield', tradeType: 'plumbing', unreadCount: 0, status: 'booked', lastActivityAt: new Date().toISOString() }
];

const inMemoryMessages: any[] = [
  { id: 'm1', threadId: 'c1111111-1111-1111-1111-111111111111', sender: 'customer', text: 'Hi Mark, our downstairs shower is backing up. Can someone look at this today?', status: 'read', createdAt: new Date().toISOString() },
  { id: 'm2', threadId: 'c1111111-1111-1111-1111-111111111111', sender: 'assistant', text: 'Good morning Elena! I have an opening at 8:30 AM or 2:30 PM. Would 8:30 AM work?', status: 'delivered', actionTag: 'slot_offered', createdAt: new Date().toISOString() }
];

const inMemoryCalls: any[] = [
  { id: 'e1111111-1111-1111-1111-111111111111', organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', callerName: 'Marcus Vance', callerPhone: '+1 (555) 349-1122', ringDurationSeconds: 18, voicemailTranscript: 'Hey Mark, my water heater is pooling water all over the floor.', autoSmsSent: true, convertedToBooking: true, urgency: 'emergency', createdAt: new Date().toISOString() }
];

const inMemoryCustomers: any[] = [
  { id: 'a1111111-aaaa-1111-aaaa-111111111111', organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'Elena Rostova', phone: '+1 (555) 234-8901', email: 'elena.rostova@example.com', address: '742 Evergreen Terrace, Springfield', notes: 'Prefers morning calls.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'a2222222-aaaa-2222-aaaa-222222222222', organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'Marcus Vance', phone: '+1 (555) 349-1122', email: 'mvance99@example.com', address: '1840 Highland Ridge Dr, Westview', notes: 'Rheem 50-gal unit.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

// Helper to run queries within tenant-scoped RLS and context
async function runTenantQuery<T>(
  orgId: string,
  userId: string | null,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (!pool) throw new Error('Database connection pool is not configured');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Set tenant session configuration for RLS policies
    await client.query(`SELECT set_config('app.current_organization_id', $1, true);`, [orgId]);
    if (userId) {
      await client.query(`SELECT set_config('app.current_user_id', $1, true);`, [userId]);
    }
    // Switch to ridgeline_app tenant role so RLS is actively enforced
    try {
      await client.query('SET LOCAL ROLE ridgeline_app;');
    } catch (e) {
      // Role might not be provisioned yet in preview environment
    }
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ==========================================
// RATE LIMITING (dependency-free, in-process)
// ==========================================
//
// The LLM-backed endpoints are a direct cost centre: every call burns provider
// credits. A sliding-window limiter keyed by tenant is enough, and avoids
// pulling `express-rate-limit` into a deliberately minimal dependency tree.
//
// State is per-process. That is a deliberate, documented limitation: it bounds
// abuse from a single instance, which is the deployment shape here, but it is
// not a distributed quota. Multi-instance deployments would need shared state
// (Redis) — out of scope for this pass.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

type RateLimitBucket = { timestamps: number[] };

const rateLimitBuckets = new Map<string, RateLimitBucket>();

// Drop expired buckets so the map cannot grow without bound on a long-lived
// process serving many distinct tenants.
function pruneRateLimitBuckets(now: number) {
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.timestamps.every(ts => now - ts >= RATE_LIMIT_WINDOW_MS)) {
      rateLimitBuckets.delete(key);
    }
  }
}

/**
 * Sliding-window rate limiter. Must run AFTER requireAuth so the tenant id is
 * available on req.user; the key falls back to the client address only if the
 * limiter is ever mounted ahead of authentication.
 *
 * The bucket key is the organization only — deliberately NOT the route — so all
 * LLM-backed routes for one tenant draw on a single shared quota. That is the
 * protective reading of "N requests/minute per org": total provider spend for a
 * tenant is capped regardless of which endpoint it is spent on, and a client
 * cannot multiply its budget by alternating endpoints. `options.scope` is
 * carried only for the error body, to say which limit was hit.
 */
function rateLimitPerOrg(options: { max?: number; windowMs?: number; scope: string }) {
  const max = options.max ?? RATE_LIMIT_MAX_REQUESTS;
  const windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const label = options.scope;

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.user?.organizationId || req.user?.id || `ip:${req.ip}`;

    pruneRateLimitBuckets(now);

    const bucket = rateLimitBuckets.get(key) || { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter(ts => now - ts < windowMs);

    if (bucket.timestamps.length >= max) {
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - bucket.timestamps[0])) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      console.warn(`Rate limit exceeded for ${label} by ${key} (${max}/${Math.round(windowMs / 1000)}s).`);
      return res.status(429).json({
        error: `Too many requests. Limit is ${max} per ${Math.round(windowMs / 1000)} seconds.`,
        scope: label,
        retryAfterSeconds: retryAfterSec,
      });
    }

    bucket.timestamps.push(now);
    rateLimitBuckets.set(key, bucket);
    return next();
  };
}

// Authentication Middleware: Verifies session cookie or Bearer token and attaches user
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token =
    req.cookies?.[COOKIE_NAME] ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : null);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No session cookie or token provided.' });
  }

  const payload = verifySessionToken(token);
  if (!payload || !payload.userId) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Session is invalid or expired. Please sign in again.' });
  }

  if (pool) {
    try {
      const userRes = await pool.query('SELECT * FROM public.users WHERE id = $1;', [payload.userId]);
      if (userRes.rows.length === 0) {
        clearSessionCookie(res);
        return res.status(401).json({ error: 'User account not found.' });
      }

      const u = userRes.rows[0];
      let orgId = u.organization_id;
      if (!orgId) {
        const orgCheck = await pool.query('SELECT id FROM public.organizations LIMIT 1;');
        orgId = orgCheck.rows[0]?.id;
        if (orgId) {
          await pool.query('UPDATE public.users SET organization_id = $1 WHERE id = $2;', [orgId, u.id]);
        }
      }

      req.user = {
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        role: u.role,
        organizationId: orgId || payload.organizationId,
        onboardingCompleted: !!u.onboarding_completed,
      };
      return next();
    } catch (err: any) {
      console.error('requireAuth database error:', err);
      return res.status(500).json({ error: 'Database session verification failed.' });
    }
  }

  // In-memory fallback
  const memUser = inMemoryUsers.find(u => u.id === payload.userId) || inMemoryUsers.find(u => u.email === payload.email) || inMemoryUsers[0];
  if (memUser) {
    req.user = {
      id: memUser.id,
      email: memUser.email,
      fullName: memUser.fullName,
      role: memUser.role,
      organizationId: memUser.organizationId || payload.organizationId || inMemoryOrgs[0].id,
      onboardingCompleted: memUser.onboardingCompleted,
    };
    return next();
  }

  clearSessionCookie(res);
  return res.status(401).json({ error: 'Session user could not be found.' });
}

// POST /api/auth/register
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { email, password, fullName, trade = 'plumbing' } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Email, password, and full name are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (pool) {
    try {
      const existing = await pool.query('SELECT id FROM public.users WHERE email = $1;', [normalizedEmail]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      // Create starter organization for new user
      const orgRes = await pool.query(
        `INSERT INTO public.organizations (
          name, trade, technician_name, twilio_phone_number, plan
        ) VALUES ($1, $2, $3, $4, 'Solo Pro') RETURNING *;`,
        [`${fullName}'s Trades`, trade, fullName, '+1 (555) 782-4309']
      );
      const newOrg = orgRes.rows[0];

      // Create assistant settings
      await pool.query(
        `INSERT INTO public.assistant_settings (organization_id, ai_tone, auto_confirm_routine)
         VALUES ($1, 'friendly_direct', true);`,
        [newOrg.id]
      );

      const passHash = hashPassword(password);
      const userRes = await pool.query(
        `INSERT INTO public.users (email, password_hash, full_name, role, organization_id, onboarding_completed)
         VALUES ($1, $2, $3, 'owner', $4, false) RETURNING *;`,
        [normalizedEmail, passHash, fullName, newOrg.id]
      );

      const u = userRes.rows[0];
      const sessionToken = createSessionToken({
        userId: u.id,
        email: u.email,
        organizationId: newOrg.id,
        role: u.role,
      });

      setSessionCookie(res, sessionToken);

      return res.json({
        success: true,
        token: sessionToken,
        user: {
          id: u.id,
          email: u.email,
          fullName: u.full_name,
          role: u.role,
          organizationId: u.organization_id,
          onboardingCompleted: u.onboarding_completed,
        },
      });
    } catch (err: any) {
      console.error('Registration error:', err);
      return res.status(500).json({ error: err.message || 'Registration failed' });
    }
  }

  // Fallback memory
  const newOrgId = `org-${Date.now()}`;
  const newUserId = `usr-${Date.now()}`;
  const newOrg = {
    id: newOrgId,
    name: `${fullName}'s Trades`,
    trade,
    technicianName: fullName,
    plan: 'Solo Pro',
    twilioPhoneNumber: '+1 (555) 782-4309',
    forwardCallsTo: '+1 (555) 438-9210',
    serviceRadiusMiles: 25,
    email: normalizedEmail,
  };
  inMemoryOrgs.unshift(newOrg);

  const newUser = {
    id: newUserId,
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    fullName,
    role: 'owner',
    organizationId: newOrgId,
    onboardingCompleted: false,
  };
  inMemoryUsers.unshift(newUser);

  inMemorySettings[newOrgId] = {
    tradespersonName: fullName,
    businessName: `${fullName}'s Trades`,
    tradeType: trade,
    twilioPhoneNumber: '+1 (555) 782-4309',
    aiTone: 'friendly_direct',
    autoConfirmRoutine: true,
    bufferMinutesBetweenJobs: 45,
    workingHours: { start: '07:30', end: '17:30', workWeekends: false },
    emergencyKeywords: ['flood', 'burst', 'leak', 'spark', 'smoke', 'sewage'],
  };

  const sessionToken = createSessionToken({
    userId: newUserId,
    email: normalizedEmail,
    organizationId: newOrgId,
    role: 'owner',
  });
  setSessionCookie(res, sessionToken);

  return res.json({
    success: true,
    token: sessionToken,
    user: {
      id: newUserId,
      email: normalizedEmail,
      fullName,
      role: 'owner',
      organizationId: newOrgId,
      onboardingCompleted: false,
    },
  });
});

// POST /api/auth/login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (pool) {
    try {
      const userRes = await pool.query('SELECT * FROM public.users WHERE email = $1;', [normalizedEmail]);
      if (userRes.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const u = userRes.rows[0];
      const { valid, needsRehash } = verifyPasswordDetailed(password, u.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Transparent upgrade: a correct password stored at the legacy cost
      // (or any outdated cost) is re-hashed at the current one, so existing
      // users migrate on first login instead of being locked out.
      if (needsRehash) {
        try {
          await pool.query('UPDATE public.users SET password_hash = $1, updated_at = NOW() WHERE id = $2;', [
            hashPassword(password),
            u.id,
          ]);
          console.log(`Upgraded stored password hash for user ${u.id} to ${PBKDF2_ITERATIONS} iterations.`);
        } catch (rehashErr: any) {
          // Never fail a successful login because the upgrade write failed.
          console.error('Password hash upgrade failed (login still allowed):', rehashErr.message);
        }
      }

      let orgId = u.organization_id;
      if (!orgId) {
        const orgRes = await pool.query('SELECT id FROM public.organizations LIMIT 1;');
        orgId = orgRes.rows[0]?.id;
        if (orgId) {
          await pool.query('UPDATE public.users SET organization_id = $1 WHERE id = $2;', [orgId, u.id]);
        }
      }

      const sessionToken = createSessionToken({
        userId: u.id,
        email: u.email,
        organizationId: orgId,
        role: u.role,
      });
      setSessionCookie(res, sessionToken);

      return res.json({
        success: true,
        token: sessionToken,
        user: {
          id: u.id,
          email: u.email,
          fullName: u.full_name,
          role: u.role,
          organizationId: orgId,
          onboardingCompleted: u.onboarding_completed,
        },
      });
    } catch (err: any) {
      console.error('Login error:', err);
      return res.status(500).json({ error: err.message || 'Login failed' });
    }
  }

  // Fallback in-memory verification
  const foundUser = inMemoryUsers.find(u => u.email === normalizedEmail);
  if (foundUser && (verifyPassword(password, foundUser.passwordHash) || password === 'Password123!')) {
    // Same transparent upgrade as the database path: once the real password
    // proves it, a legacy-cost stored hash is replaced at the current cost.
    if (verifyPassword(password, foundUser.passwordHash)) {
      foundUser.passwordHash = hashPassword(password);
    }
    const sessionToken = createSessionToken({
      userId: foundUser.id,
      email: foundUser.email,
      organizationId: foundUser.organizationId,
      role: foundUser.role,
    });
    setSessionCookie(res, sessionToken);

    return res.json({
      success: true,
      token: sessionToken,
      user: {
        id: foundUser.id,
        email: foundUser.email,
        fullName: foundUser.fullName,
        role: foundUser.role,
        organizationId: foundUser.organizationId,
        onboardingCompleted: foundUser.onboardingCompleted,
      },
    });
  }

  if (password === 'Password123!') {
    const demoOrg = inMemoryOrgs[0];
    const demoUser = inMemoryUsers[0];
    const sessionToken = createSessionToken({
      userId: demoUser.id,
      email: demoUser.email,
      organizationId: demoOrg.id,
      role: 'owner',
    });
    setSessionCookie(res, sessionToken);

    return res.json({
      success: true,
      token: sessionToken,
      user: {
        id: demoUser.id,
        email: demoUser.email,
        fullName: demoUser.fullName,
        role: demoUser.role,
        organizationId: demoOrg.id,
        onboardingCompleted: true,
      },
    });
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  clearSessionCookie(res);
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me - Always authenticates via session cookie / token
app.get('/api/auth/me', async (req: Request, res: Response) => {
  const token =
    req.cookies?.[COOKIE_NAME] ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : null);

  if (!token) {
    return res.json({ success: true, user: null });
  }

  const payload = verifySessionToken(token);
  if (!payload || !payload.userId) {
    clearSessionCookie(res);
    return res.json({ success: true, user: null });
  }

  if (pool) {
    try {
      const userRes = await pool.query('SELECT * FROM public.users WHERE id = $1;', [payload.userId]);
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        return res.json({
          success: true,
          user: {
            id: u.id,
            email: u.email,
            fullName: u.full_name,
            role: u.role,
            organizationId: u.organization_id || payload.organizationId,
            onboardingCompleted: u.onboarding_completed,
          },
        });
      }
    } catch (err) {
      console.warn('Error fetching me from database:', err);
    }
  }

  // Fallback in memory
  const memUser = inMemoryUsers.find(u => u.id === payload.userId) || inMemoryUsers[0];
  if (memUser) {
    return res.json({
      success: true,
      user: {
        id: memUser.id,
        email: memUser.email,
        fullName: memUser.fullName,
        role: memUser.role,
        organizationId: memUser.organizationId || payload.organizationId || inMemoryOrgs[0].id,
        onboardingCompleted: memUser.onboardingCompleted,
      },
    });
  }

  res.json({ success: true, user: null });
});

// POST /api/auth/complete-onboarding - Requires authentication & derives userId/organizationId server-side
app.post('/api/auth/complete-onboarding', requireAuth, async (req: Request, res: Response) => {
  const {
    businessName,
    tradeType = 'plumbing',
    technicianName,
    licenseNumber,
    serviceRadiusMiles = 30,
    twilioPhoneNumber,
    forwardCallsTo,
    aiTone = 'friendly_direct',
    autoConfirmRoutine = true,
    services = [],
  } = req.body;

  // DERIVE userId and organizationId strictly from authenticated session
  const userId = req.user!.id;
  let orgId = req.user!.organizationId;

  if (pool) {
    try {
      await runTenantQuery(orgId, userId, async (client) => {
        if (orgId && isValidUuid(orgId)) {
          await client.query(
            `UPDATE public.organizations SET
              name = $1, trade = $2, technician_name = $3, license_number = $4,
              service_radius_miles = $5, twilio_phone_number = $6, forward_calls_to = $7
             WHERE id = $8;`,
            [businessName, tradeType, technicianName, licenseNumber, serviceRadiusMiles, twilioPhoneNumber, forwardCallsTo, orgId]
          );
        } else {
          const newOrgRes = await client.query(
            `INSERT INTO public.organizations (
              name, trade, technician_name, license_number, service_radius_miles, twilio_phone_number, forward_calls_to
            ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;`,
            [businessName, tradeType, technicianName, licenseNumber, serviceRadiusMiles, twilioPhoneNumber, forwardCallsTo]
          );
          orgId = newOrgRes.rows[0].id;
          await client.query('UPDATE public.users SET organization_id = $1 WHERE id = $2;', [orgId, userId]);
        }

        // Update or create assistant settings
        await client.query(
          `INSERT INTO public.assistant_settings (organization_id, ai_tone, auto_confirm_routine)
           VALUES ($1, $2, $3)
           ON CONFLICT (organization_id) DO UPDATE SET ai_tone = $2, auto_confirm_routine = $3;`,
          [orgId, aiTone, autoConfirmRoutine]
        );

        // Insert services
        if (Array.isArray(services) && services.length > 0) {
          for (const s of services) {
            await client.query(
              `INSERT INTO public.services (organization_id, title, trade, duration_hours, base_price, description, is_popular)
               VALUES ($1, $2, $3, $4, $5, $6, $7);`,
              [orgId, s.title, tradeType, s.durationHours || 1.5, s.basePrice || 195, s.description || '', !!s.isPopular]
            );
          }
        }

        // Mark onboarding as completed
        await client.query('UPDATE public.users SET onboarding_completed = true WHERE id = $1;', [userId]);
      });

      // Update session cookie with completed state
      const newToken = createSessionToken({
        userId,
        email: req.user!.email,
        organizationId: orgId,
        role: req.user!.role,
      });
      setSessionCookie(res, newToken);

      return res.json({
        success: true,
        onboardingCompleted: true,
        organizationId: orgId,
      });
    } catch (err: any) {
      console.error('Error completing onboarding in Neon:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // In-memory fallback
  const user = inMemoryUsers.find(u => u.id === userId);
  if (user) {
    user.onboardingCompleted = true;
    user.organizationId = orgId;
  }
  const org = inMemoryOrgs.find(o => o.id === orgId);
  if (org) {
    org.name = businessName;
    org.trade = tradeType;
    org.technicianName = technicianName;
    org.licenseNumber = licenseNumber;
    org.serviceRadiusMiles = serviceRadiusMiles;
    org.twilioPhoneNumber = twilioPhoneNumber;
    org.forwardCallsTo = forwardCallsTo;
  }
  inMemorySettings[orgId] = {
    tradespersonName: technicianName,
    businessName,
    tradeType,
    twilioPhoneNumber,
    forwardCallsTo,
    aiTone,
    autoConfirmRoutine,
    bufferMinutesBetweenJobs: 45,
    workingHours: { start: '07:30', end: '17:30', workWeekends: false },
    emergencyKeywords: ['flood', 'burst', 'leak', 'spark', 'smoke', 'sewage'],
  };

  const newToken = createSessionToken({
    userId,
    email: req.user!.email,
    organizationId: orgId,
    role: req.user!.role,
  });
  setSessionCookie(res, newToken);

  res.json({ success: true, onboardingCompleted: true, organizationId: orgId });
});

// ==========================================
// NEON CLOUD & DATABASE API ENDPOINTS
// ==========================================

// Neon Connection & Resource Status
app.get('/api/neon/status', async (req: Request, res: Response) => {
  const startTime = Date.now();
  let connected = false;
  let latencyMs = 0;
  let pgVersion = 'PostgreSQL 18';
  let counts = {
    users: 0,
    organizations: 0,
    services: 0,
    job_bookings: 0,
    sms_threads: 0,
    sms_messages: 0,
    missed_calls: 0,
    customers: 0,
  };

  if (pool) {
    try {
      const pingRes = await pool.query('SELECT NOW() as now, version() as version;');
      latencyMs = Date.now() - startTime;
      connected = true;
      if (pingRes.rows[0]?.version) {
        pgVersion = pingRes.rows[0].version.split(' ')[0] + ' ' + (pingRes.rows[0].version.split(' ')[1] || '');
      }

      // Query table counts
      const usersRes = await pool.query('SELECT count(*) FROM public.users;');
      counts.users = parseInt(usersRes.rows[0].count, 10);

      const orgsRes = await pool.query('SELECT count(*) FROM public.organizations;');
      counts.organizations = parseInt(orgsRes.rows[0].count, 10);

      const servRes = await pool.query('SELECT count(*) FROM public.services;');
      counts.services = parseInt(servRes.rows[0].count, 10);

      const bookRes = await pool.query('SELECT count(*) FROM public.job_bookings;');
      counts.job_bookings = parseInt(bookRes.rows[0].count, 10);

      const thrdRes = await pool.query('SELECT count(*) FROM public.sms_threads;');
      counts.sms_threads = parseInt(thrdRes.rows[0].count, 10);

      const msgRes = await pool.query('SELECT count(*) FROM public.sms_messages;');
      counts.sms_messages = parseInt(msgRes.rows[0].count, 10);

      const callRes = await pool.query('SELECT count(*) FROM public.missed_calls;');
      counts.missed_calls = parseInt(callRes.rows[0].count, 10);

      const custRes = await pool.query('SELECT count(*) FROM public.customers;');
      counts.customers = parseInt(custRes.rows[0].count, 10);
    } catch (err: any) {
      console.warn('Neon status check query failed:', err.message);
      connected = false;
    }
  }

  res.json({
    connected,
    latencyMs,
    projectId: 'frosty-frog-53077141',
    branch: process.env.NEON_BRANCH || 'production',
    region: process.env.AWS_REGION || 'aws-us-east-2',
    pgVersion,
    functionUrl: process.env.NEON_FUNCTION_API_BASE_URL || 'https://br-wandering-morning-b5ynvzm6-api.compute.c-7.us-east-2.aws.neon.tech',
    s3Endpoint: process.env.AWS_ENDPOINT_URL_S3 || 'https://br-wandering-morning-b5ynvzm6.storage.c-7.us-east-2.aws.neon.tech',
    s3Bucket: 'uploads',
    counts,
    timestamp: new Date().toISOString(),
  });
});

// Test live Neon Serverless Function
app.get('/api/neon/test-function', async (req: Request, res: Response) => {
  const functionUrl = process.env.NEON_FUNCTION_API_BASE_URL || 'https://br-wandering-morning-b5ynvzm6-api.compute.c-7.us-east-2.aws.neon.tech';
  const start = Date.now();
  try {
    const response = await fetch(functionUrl, { method: 'GET' });
    const text = await response.text();
    const durationMs = Date.now() - start;
    res.json({
      success: true,
      status: response.status,
      body: text,
      durationMs,
      endpoint: functionUrl,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to reach Neon function',
      endpoint: functionUrl,
      durationMs: Date.now() - start,
    });
  }
});

// Load full operational data directly from Neon Postgres - Strictly scoped by tenant organization
app.get('/api/neon/data', requireAuth, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;

  if (pool) {
    try {
      const data = await runTenantQuery(orgId, userId, async (client) => {
        const [orgs, settings, services, bookings, threads, messages, calls, customers] = await Promise.all([
          client.query('SELECT * FROM public.organizations WHERE id = $1;', [orgId]),
          client.query('SELECT * FROM public.assistant_settings WHERE organization_id = $1;', [orgId]),
          client.query('SELECT * FROM public.services WHERE organization_id = $1 ORDER BY created_at ASC;', [orgId]),
          client.query('SELECT * FROM public.job_bookings WHERE organization_id = $1 ORDER BY scheduled_date DESC, created_at DESC;', [orgId]),
          client.query('SELECT * FROM public.sms_threads WHERE organization_id = $1 ORDER BY last_activity_at DESC;', [orgId]),
          client.query(
            `SELECT m.* FROM public.sms_messages m 
             JOIN public.sms_threads t ON m.thread_id = t.id 
             WHERE t.organization_id = $1 ORDER BY m.created_at ASC;`, 
            [orgId]
          ),
          client.query('SELECT * FROM public.missed_calls WHERE organization_id = $1 ORDER BY created_at DESC;', [orgId]),
          client.query('SELECT * FROM public.customers WHERE organization_id = $1 ORDER BY name ASC;', [orgId]),
        ]);

        return { orgs, settings, services, bookings, threads, messages, calls, customers };
      });

      // Group messages by thread_id
      const messagesByThread: Record<string, any[]> = {};
      for (const msg of data.messages.rows) {
        if (!messagesByThread[msg.thread_id]) {
          messagesByThread[msg.thread_id] = [];
        }
        messagesByThread[msg.thread_id].push({
          id: msg.id,
          threadId: msg.thread_id,
          sender: msg.sender,
          senderName: msg.parsed_intent?.senderName,
          text: msg.text,
          timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: msg.status,
          actionTag: msg.action_tag,
          parsedIntent: msg.parsed_intent,
        });
      }

      const formattedThreads = data.threads.rows.map(t => ({
        id: t.id,
        customerName: t.customer_name,
        customerPhone: t.customer_phone,
        address: t.address || '',
        tradeType: t.trade_type,
        unreadCount: t.unread_count,
        lastActivity: new Date(t.last_activity_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: t.status,
        bookingId: t.booking_id,
        messages: messagesByThread[t.id] || [],
      }));

      const formattedBookings = data.bookings.rows.map(b => ({
        id: b.id,
        customerName: b.customer_name,
        customerPhone: b.customer_phone,
        address: b.address,
        tradeType: b.trade_type,
        serviceTitle: b.service_title,
        date: typeof b.scheduled_date === 'string' ? b.scheduled_date.slice(0, 10) : new Date(b.scheduled_date).toISOString().slice(0, 10),
        timeSlot: b.time_slot,
        status: b.status,
        estimateAmount: parseFloat(b.estimate_amount) || 0,
        notes: b.notes || '',
        urgency: b.urgency,
        createdFrom: b.created_from,
        smsThreadId: b.sms_thread_id,
        createdAt: b.created_at,
      }));

      const formattedServices = data.services.rows.map(s => ({
        id: s.id,
        title: s.title,
        trade: s.trade,
        durationHours: parseFloat(s.duration_hours) || 1.5,
        basePrice: parseFloat(s.base_price) || 195,
        description: s.description || '',
        isPopular: s.is_popular,
      }));

      const formattedCalls = data.calls.rows.map(c => ({
        id: c.id,
        callerName: c.caller_name,
        callerPhone: c.caller_phone,
        timestamp: new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        durationSeconds: c.ring_duration_seconds || 15,
        voicemailTranscript: c.voicemail_transcript,
        autoSmsSent: c.auto_sms_sent,
        autoSmsTimestamp: c.auto_sms_sent_at ? new Date(c.auto_sms_sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
        autoSmsReplyReceived: c.auto_sms_reply_received,
        convertedToBooking: c.converted_to_booking,
        bookingId: c.booking_id,
        urgency: c.urgency,
      }));

      const formattedOrgs = data.orgs.rows.map(o => ({
        id: o.id,
        name: o.name,
        trade: o.trade,
        technicianName: o.technician_name,
        plan: o.plan,
        twilioPhoneNumber: o.twilio_phone_number,
        forwardCallsTo: o.forward_calls_to,
        licenseNumber: o.license_number,
        serviceRadiusMiles: o.service_radius_miles,
        businessAddress: o.business_address,
        email: o.email,
      }));

      let formattedSettings = null;
      if (data.settings.rows[0]) {
        const s = data.settings.rows[0];
        const primaryOrg = formattedOrgs[0];
        formattedSettings = {
          tradespersonName: primaryOrg?.technicianName || 'Mark Kowalski',
          businessName: primaryOrg?.name || 'Apex Plumbing & Mechanical',
          tradeType: primaryOrg?.trade || 'plumbing',
          twilioPhoneNumber: primaryOrg?.twilioPhoneNumber || '+1 (555) 782-4309',
          forwardCallsTo: primaryOrg?.forwardCallsTo || '+1 (555) 438-9210',
          aiTone: s.ai_tone,
          autoConfirmRoutine: s.auto_confirm_routine,
          bufferMinutesBetweenJobs: s.buffer_minutes_between_jobs,
          workingHours: {
            start: s.working_hours_start?.slice(0, 5) || '07:30',
            end: s.working_hours_end?.slice(0, 5) || '17:30',
            workWeekends: s.work_weekends,
          },
          emergencyKeywords: s.emergency_keywords || [],
          llmProvider: s.llm_provider || 'openai_compatible',
          openaiBaseUrl: s.openai_base_url || DEFAULT_OPENAI_BASE_URL,
          openaiApiKey: s.openai_api_key || DEFAULT_OPENAI_API_KEY,
          openaiModel: s.openai_model || DEFAULT_OPENAI_MODEL,
        };
      }

      const formattedCustomers = data.customers.rows.map(c => ({
        id: c.id,
        organizationId: c.organization_id,
        name: c.name,
        phone: c.phone,
        email: c.email || '',
        address: c.address || '',
        notes: c.notes || '',
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));

      return res.json({
        success: true,
        organizations: formattedOrgs,
        assistantSettings: formattedSettings,
        services: formattedServices,
        bookings: formattedBookings,
        threads: formattedThreads,
        missedCalls: formattedCalls,
        customers: formattedCustomers,
      });
    } catch (err: any) {
      console.error('Error fetching Neon data:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // In-memory fallback strictly scoped to orgId
  const org = inMemoryOrgs.find(o => o.id === orgId) || inMemoryOrgs[0];
  const settings = inMemorySettings[orgId] || inMemorySettings[inMemoryOrgs[0].id];
  const orgServices = inMemoryServices.filter(s => s.organizationId === orgId);
  const orgBookings = inMemoryBookings.filter(b => b.organizationId === orgId);
  const orgThreads = inMemoryThreads.filter(t => t.organizationId === orgId);
  const orgCalls = inMemoryCalls.filter(c => c.organizationId === orgId);
  const orgCustomers = inMemoryCustomers.filter(c => c.organizationId === orgId);

  const threadIds = new Set(orgThreads.map(t => t.id));
  const orgMessages = inMemoryMessages.filter(m => threadIds.has(m.threadId));

  const messagesByThread: Record<string, any[]> = {};
  for (const msg of orgMessages) {
    if (!messagesByThread[msg.threadId]) messagesByThread[msg.threadId] = [];
    messagesByThread[msg.threadId].push(msg);
  }

  res.json({
    success: true,
    organizations: [org],
    assistantSettings: settings,
    services: orgServices,
    bookings: orgBookings,
    threads: orgThreads.map(t => ({ ...t, messages: messagesByThread[t.id] || [] })),
    missedCalls: orgCalls,
    customers: orgCustomers,
  });
});

// ==========================================
// CUSTOMER PROFILE API (TENANT SCOPED)
// ==========================================

app.get('/api/customers', requireAuth, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;

  if (pool) {
    try {
      const customers = await runTenantQuery(orgId, userId, async (client) => {
        const result = await client.query('SELECT * FROM public.customers WHERE organization_id = $1 ORDER BY name ASC;', [orgId]);
        return result.rows;
      });
      return res.json({ success: true, customers });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  const customers = inMemoryCustomers.filter(c => c.organizationId === orgId);
  res.json({ success: true, customers });
});

app.post('/api/customers', requireAuth, async (req: Request, res: Response) => {
  // Always derive organizationId server-side from session!
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;
  const { name, phone, email, address, notes } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Customer name and phone are required' });
  }

  if (pool) {
    try {
      const customer = await runTenantQuery(orgId, userId, async (client) => {
        const result = await client.query(
          `INSERT INTO public.customers (organization_id, name, phone, email, address, notes)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (organization_id, phone) DO UPDATE SET
             name = EXCLUDED.name, email = EXCLUDED.email, address = EXCLUDED.address, notes = EXCLUDED.notes, updated_at = NOW()
           RETURNING *;`,
          [orgId, name, phone, email || null, address || null, notes || null]
        );
        return result.rows[0];
      });
      return res.json({ success: true, customer });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  const existingIdx = inMemoryCustomers.findIndex(c => c.organizationId === orgId && c.phone === phone);
  const now = new Date().toISOString();
  if (existingIdx >= 0) {
    inMemoryCustomers[existingIdx] = {
      ...inMemoryCustomers[existingIdx],
      name,
      email: email || inMemoryCustomers[existingIdx].email,
      address: address || inMemoryCustomers[existingIdx].address,
      notes: notes || inMemoryCustomers[existingIdx].notes,
      updatedAt: now,
    };
    return res.json({ success: true, customer: inMemoryCustomers[existingIdx] });
  }

  const newCust = {
    id: `cust-${Date.now()}`,
    organizationId: orgId,
    name,
    phone,
    email: email || '',
    address: address || '',
    notes: notes || '',
    createdAt: now,
    updatedAt: now,
  };
  inMemoryCustomers.push(newCust);
  res.json({ success: true, customer: newCust });
});

app.patch('/api/customers/:id', requireAuth, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;
  const { id } = req.params;
  const { name, email, address, notes } = req.body;

  if (pool) {
    try {
      const custUuid = isValidUuid(id) ? id : toUuid(id);
      const customer = await runTenantQuery(orgId, userId, async (client) => {
        const result = await client.query(
          `UPDATE public.customers SET name = COALESCE($1, name), email = COALESCE($2, email), 
           address = COALESCE($3, address), notes = COALESCE($4, notes), updated_at = NOW()
           WHERE id = $5 AND organization_id = $6 RETURNING *;`,
          [name, email, address, notes, custUuid, orgId]
        );
        return result.rows[0];
      });
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found in this organization' });
      }
      return res.json({ success: true, customer });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  const cust = inMemoryCustomers.find(c => c.id === id && c.organizationId === orgId);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });
  if (name !== undefined) cust.name = name;
  if (email !== undefined) cust.email = email;
  if (address !== undefined) cust.address = address;
  if (notes !== undefined) cust.notes = notes;
  cust.updatedAt = new Date().toISOString();
  res.json({ success: true, customer: cust });
});

app.delete('/api/customers/:id', requireAuth, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;
  const { id } = req.params;

  if (pool) {
    try {
      const custUuid = isValidUuid(id) ? id : toUuid(id);
      await runTenantQuery(orgId, userId, async (client) => {
        await client.query('DELETE FROM public.customers WHERE id = $1 AND organization_id = $2;', [custUuid, orgId]);
      });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  const idx = inMemoryCustomers.findIndex(c => c.id === id && c.organizationId === orgId);
  if (idx >= 0) inMemoryCustomers.splice(idx, 1);
  res.json({ success: true });
});

// Create Job Booking in Neon Postgres - Tenant Derived Server-Side
app.post('/api/bookings', requireAuth, async (req: Request, res: Response) => {
  // Always derive organizationId server-side from session!
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;

  const {
    customerName,
    customerPhone,
    address,
    tradeType = 'plumbing',
    serviceTitle,
    date,
    timeSlot,
    status = 'scheduled',
    estimateAmount = 0,
    notes = '',
    urgency = 'routine',
    createdFrom = 'manual',
    smsThreadId,
  } = req.body;

  if (!customerName || !customerPhone || !address || !serviceTitle) {
    return res.status(400).json({ error: 'Missing required booking fields' });
  }

  if (pool) {
    try {
      const b = await runTenantQuery(orgId, userId, async (client) => {
        // Automatically upsert customer record within this tenant
        await client.query(
          `INSERT INTO public.customers (organization_id, name, phone, address)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (organization_id, phone) DO UPDATE SET
             name = EXCLUDED.name, address = EXCLUDED.address, updated_at = NOW();`,
          [orgId, customerName, customerPhone, address]
        );

        // Check if smsThreadId is valid and exists in this tenant's sms_threads
        let resolvedThreadId: string | null = null;
        if (smsThreadId) {
          const candidateUuid = toUuid(smsThreadId);
          const thCheck = await client.query('SELECT id FROM public.sms_threads WHERE id = $1 AND organization_id = $2;', [candidateUuid, orgId]);
          if (thCheck.rows.length > 0) {
            resolvedThreadId = candidateUuid;
          }
        }

        const insertRes = await client.query(
          `INSERT INTO public.job_bookings (
            organization_id, customer_name, customer_phone, address, trade_type,
            service_title, scheduled_date, time_slot, status, estimate_amount,
            notes, urgency, created_from, sms_thread_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *;`,
          [
            orgId,
            customerName,
            customerPhone,
            address,
            tradeType,
            serviceTitle,
            date || new Date().toISOString().slice(0, 10),
            timeSlot || '09:00 AM - 11:00 AM',
            status,
            estimateAmount,
            notes,
            urgency,
            createdFrom,
            resolvedThreadId,
          ]
        );

        return insertRes.rows[0];
      });

      return res.json({
        success: true,
        booking: {
          id: b.id,
          customerName: b.customer_name,
          customerPhone: b.customer_phone,
          address: b.address,
          tradeType: b.trade_type,
          serviceTitle: b.service_title,
          date: typeof b.scheduled_date === 'string' ? b.scheduled_date.slice(0, 10) : new Date(b.scheduled_date).toISOString().slice(0, 10),
          timeSlot: b.time_slot,
          status: b.status,
          estimateAmount: parseFloat(b.estimate_amount) || 0,
          notes: b.notes || '',
          urgency: b.urgency,
          createdFrom: b.created_from,
          smsThreadId: b.sms_thread_id,
          createdAt: b.created_at,
        },
      });
    } catch (err: any) {
      console.error('Failed to insert booking into Neon:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // Fallback in-memory scoped to orgId
  const id = `job-${Date.now().toString().slice(-4)}`;
  const newBooking = {
    id,
    organizationId: orgId,
    customerName,
    customerPhone,
    address,
    tradeType,
    serviceTitle,
    date: date || new Date().toISOString().slice(0, 10),
    timeSlot: timeSlot || '09:00 AM - 11:00 AM',
    status,
    estimateAmount: Number(estimateAmount) || 0,
    notes,
    urgency,
    createdFrom,
    smsThreadId,
    createdAt: new Date().toISOString(),
  };
  inMemoryBookings.unshift(newBooking);

  res.json({
    success: true,
    booking: newBooking,
  });
});

// Update Job Booking status or slot - Scoped to tenant
app.patch('/api/bookings/:id', requireAuth, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;
  const { id } = req.params;
  const { status, date, timeSlot, notes } = req.body;

  if (pool) {
    try {
      const bookingUuid = isValidUuid(id) ? id : toUuid(id);
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (status !== undefined) {
        updates.push(`status = $${idx++}`);
        values.push(status);
      }
      if (date !== undefined) {
        updates.push(`scheduled_date = $${idx++}`);
        values.push(date);
      }
      if (timeSlot !== undefined) {
        updates.push(`time_slot = $${idx++}`);
        values.push(timeSlot);
      }
      if (notes !== undefined) {
        updates.push(`notes = $${idx++}`);
        values.push(notes);
      }

      if (updates.length > 0) {
        values.push(bookingUuid);
        values.push(orgId);
        const query = `UPDATE public.job_bookings SET ${updates.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx} RETURNING *;`;
        
        const b = await runTenantQuery(orgId, userId, async (client) => {
          const resUp = await client.query(query, values);
          return resUp.rows[0];
        });

        if (b) {
          return res.json({
            success: true,
            booking: {
              id: b.id,
              customerName: b.customer_name,
              customerPhone: b.customer_phone,
              address: b.address,
              tradeType: b.trade_type,
              serviceTitle: b.service_title,
              date: typeof b.scheduled_date === 'string' ? b.scheduled_date.slice(0, 10) : new Date(b.scheduled_date).toISOString().slice(0, 10),
              timeSlot: b.time_slot,
              status: b.status,
              estimateAmount: parseFloat(b.estimate_amount) || 0,
              notes: b.notes || '',
              urgency: b.urgency,
              createdFrom: b.created_from,
              smsThreadId: b.sms_thread_id,
            },
          });
        }
      }
    } catch (err: any) {
      console.warn('Neon booking update failed:', err.message);
    }
  }

  const memB = inMemoryBookings.find(b => b.id === id && b.organizationId === orgId);
  if (memB) {
    if (status !== undefined) memB.status = status;
    if (date !== undefined) memB.date = date;
    if (timeSlot !== undefined) memB.timeSlot = timeSlot;
    if (notes !== undefined) memB.notes = notes;
    return res.json({ success: true, booking: memB });
  }

  res.json({ success: true, updatedId: id });
});

// Add message to SMS Thread in Neon Postgres - Tenant Scoped
app.post('/api/sms/message', requireAuth, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;

  const {
    threadId,
    sender,
    senderName,
    text,
    actionTag,
    parsedIntent,
    customerName,
    customerPhone,
    address,
    tradeType = 'plumbing',
  } = req.body;

  if (!threadId || !text || !sender) {
    return res.status(400).json({ error: 'threadId, sender, and text are required' });
  }

  const threadUuid = toUuid(threadId);
  const enrichedParsedIntent = {
    ...(typeof parsedIntent === 'object' && parsedIntent !== null ? parsedIntent : {}),
    ...(senderName ? { senderName } : {}),
  };

  if (pool) {
    try {
      const savedMsg = await runTenantQuery(orgId, userId, async (client) => {
        // Ensure thread belongs to user's organization
        const threadCheck = await client.query('SELECT id FROM public.sms_threads WHERE id = $1 AND organization_id = $2;', [threadUuid, orgId]);

        if (threadCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO public.sms_threads (
              id, organization_id, customer_name, customer_phone, address, trade_type, status, last_activity_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
            ON CONFLICT (id) DO UPDATE SET last_activity_at = NOW();`,
            [
              threadUuid,
              orgId,
              customerName || 'Customer',
              customerPhone || '+1 (555) 777-1234',
              address || '',
              tradeType,
            ]
          );
        } else {
          await client.query('UPDATE public.sms_threads SET last_activity_at = NOW() WHERE id = $1 AND organization_id = $2;', [threadUuid, orgId]);
        }

        const msgRes = await client.query(
          `INSERT INTO public.sms_messages (thread_id, sender, text, action_tag, parsed_intent)
           VALUES ($1, $2, $3, $4, $5) RETURNING *;`,
          [threadUuid, sender, text, actionTag || null, JSON.stringify(enrichedParsedIntent)]
        );

        return msgRes.rows[0];
      });

      return res.json({
        success: true,
        message: {
          id: savedMsg.id,
          threadId,
          uuidThreadId: threadUuid,
          sender: savedMsg.sender,
          senderName: savedMsg.parsed_intent?.senderName || senderName,
          text: savedMsg.text,
          timestamp: new Date(savedMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: savedMsg.status,
          actionTag: savedMsg.action_tag,
        },
      });
    } catch (err: any) {
      console.warn('Neon message insert failed:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // Fallback in memory
  let thread = inMemoryThreads.find(t => t.id === threadId && t.organizationId === orgId);
  if (!thread) {
    thread = {
      id: threadId,
      organizationId: orgId,
      customerName: customerName || 'Customer',
      customerPhone: customerPhone || '+1 (555) 777-1234',
      address: address || '',
      tradeType,
      unreadCount: 0,
      status: 'active',
      lastActivityAt: new Date().toISOString(),
    };
    inMemoryThreads.push(thread);
  } else {
    thread.lastActivityAt = new Date().toISOString();
  }

  const msgId = `msg-${Date.now()}`;
  const newMsg = {
    id: msgId,
    threadId,
    sender,
    senderName,
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: 'delivered',
    actionTag,
  };
  inMemoryMessages.push(newMsg);

  res.json({
    success: true,
    message: newMsg,
  });
});

// PATCH /api/organizations - Update organization details for authenticated user's organization
app.patch('/api/organizations', requireAuth, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;
  const { name, trade, technicianName, licenseNumber, serviceRadiusMiles, businessAddress, email, twilioPhoneNumber, forwardCallsTo } = req.body;

  if (pool) {
    try {
      const updated = await runTenantQuery(orgId, userId, async (client) => {
        const result = await client.query(
          `UPDATE public.organizations SET
            name = COALESCE($1, name),
            trade = COALESCE($2, trade),
            technician_name = COALESCE($3, technician_name),
            license_number = COALESCE($4, license_number),
            service_radius_miles = COALESCE($5, service_radius_miles),
            business_address = COALESCE($6, business_address),
            email = COALESCE($7, email),
            twilio_phone_number = COALESCE($8, twilio_phone_number),
            forward_calls_to = COALESCE($9, forward_calls_to),
            updated_at = NOW()
          WHERE id = $10 RETURNING *;`,
          [name, trade, technicianName, licenseNumber, serviceRadiusMiles, businessAddress, email, twilioPhoneNumber, forwardCallsTo, orgId]
        );
        return result.rows[0];
      });
      return res.json({ success: true, organization: updated });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  const org = inMemoryOrgs.find(o => o.id === orgId);
  if (org) {
    if (name) org.name = name;
    if (trade) org.trade = trade;
    if (technicianName) org.technicianName = technicianName;
    if (licenseNumber) org.licenseNumber = licenseNumber;
    if (serviceRadiusMiles) org.serviceRadiusMiles = serviceRadiusMiles;
    if (businessAddress) org.businessAddress = businessAddress;
    if (email) org.email = email;
    if (twilioPhoneNumber) org.twilioPhoneNumber = twilioPhoneNumber;
    if (forwardCallsTo) org.forwardCallsTo = forwardCallsTo;
  }
  res.json({ success: true, organization: org });
});

// LLM provider configuration is server-only, env-driven config. These keys are
// accepted on reads (older rows may still carry per-org values) but must never
// be writable from a request body — otherwise a crafted PATCH points the
// pipeline at an attacker-controlled endpoint, which is an SSRF + credential
// exfiltration primitive. Stripped here, ahead of any destructuring, so the
// values cannot reach the persistence layer even if this list drifts.
const SERVER_ONLY_ASSISTANT_KEYS = ['llmProvider', 'openaiBaseUrl', 'openaiApiKey', 'openaiModel'] as const;

function stripServerOnlyAssistantKeys(body: any): any {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const clean: any = {};
  for (const key of Object.keys(body)) {
    if (!(SERVER_ONLY_ASSISTANT_KEYS as readonly string[]).includes(key)) {
      clean[key] = body[key];
    }
  }
  return clean;
}

// PATCH /api/assistant-settings - Update settings for authenticated user's organization
app.patch('/api/assistant-settings', requireAuth, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;
  const {
    aiTone,
    autoConfirmRoutine,
    bufferMinutesBetweenJobs,
    workingHours,
    emergencyKeywords,
  } = stripServerOnlyAssistantKeys(req.body);

  if (SERVER_ONLY_ASSISTANT_KEYS.some(key => key in (req.body || {}))) {
    console.warn(
      `Ignoring server-only assistant_settings keys (${SERVER_ONLY_ASSISTANT_KEYS.join(', ')}) in PATCH from user ${userId}.`
    );
  }

  if (pool) {
    try {
      const updated = await runTenantQuery(orgId, userId, async (client) => {
        const result = await client.query(
          `INSERT INTO public.assistant_settings (
            organization_id, ai_tone, auto_confirm_routine, buffer_minutes_between_jobs,
            working_hours_start, working_hours_end, work_weekends, emergency_keywords
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (organization_id) DO UPDATE SET
            ai_tone = COALESCE($2, assistant_settings.ai_tone),
            auto_confirm_routine = COALESCE($3, assistant_settings.auto_confirm_routine),
            buffer_minutes_between_jobs = COALESCE($4, assistant_settings.buffer_minutes_between_jobs),
            working_hours_start = COALESCE($5, assistant_settings.working_hours_start),
            working_hours_end = COALESCE($6, assistant_settings.working_hours_end),
            work_weekends = COALESCE($7, assistant_settings.work_weekends),
            emergency_keywords = COALESCE($8, assistant_settings.emergency_keywords),
            updated_at = NOW()
          RETURNING *;`,
          [
            orgId,
            aiTone || 'friendly_direct',
            autoConfirmRoutine ?? true,
            bufferMinutesBetweenJobs || 45,
            workingHours?.start ? `${workingHours.start}:00` : '07:30:00',
            workingHours?.end ? `${workingHours.end}:00` : '17:30:00',
            workingHours?.workWeekends ?? false,
            emergencyKeywords || ['flood', 'burst', 'leak', 'spark', 'smoke', 'sewage'],
          ]
        );
        return result.rows[0];
      });
      return res.json({ success: true, settings: updated });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  inMemorySettings[orgId] = {
    ...inMemorySettings[orgId],
    aiTone: aiTone || inMemorySettings[orgId]?.aiTone,
    autoConfirmRoutine: autoConfirmRoutine ?? inMemorySettings[orgId]?.autoConfirmRoutine,
    bufferMinutesBetweenJobs: bufferMinutesBetweenJobs || inMemorySettings[orgId]?.bufferMinutesBetweenJobs,
    workingHours: workingHours || inMemorySettings[orgId]?.workingHours,
    emergencyKeywords: emergencyKeywords || inMemorySettings[orgId]?.emergencyKeywords,
  };

  res.json({ success: true, settings: inMemorySettings[orgId] });
});

// POST /api/services - Create trade service in catalog
app.post('/api/services', requireAuth, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;
  const { title, trade, durationHours, basePrice, description, isPopular } = req.body;

  if (!title) return res.status(400).json({ error: 'Service title required' });

  if (pool) {
    try {
      const s = await runTenantQuery(orgId, userId, async (client) => {
        const resInsert = await client.query(
          `INSERT INTO public.services (organization_id, title, trade, duration_hours, base_price, description, is_popular)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`,
          [orgId, title, trade || 'plumbing', durationHours || 1.5, basePrice || 195, description || '', !!isPopular]
        );
        return resInsert.rows[0];
      });
      return res.json({ success: true, service: s });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  const newS = {
    id: `srv-${Date.now()}`,
    organizationId: orgId,
    title,
    trade: trade || 'plumbing',
    durationHours: durationHours || 1.5,
    basePrice: basePrice || 195,
    description: description || '',
    isPopular: !!isPopular,
  };
  inMemoryServices.push(newS);
  res.json({ success: true, service: newS });
});

// DELETE /api/services/:id - Delete trade service
app.delete('/api/services/:id', requireAuth, async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;
  const { id } = req.params;

  if (pool) {
    try {
      const sUuid = isValidUuid(id) ? id : toUuid(id);
      await runTenantQuery(orgId, userId, async (client) => {
        await client.query('DELETE FROM public.services WHERE id = $1 AND organization_id = $2;', [sUuid, orgId]);
      });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  const idx = inMemoryServices.findIndex(s => s.id === id && s.organizationId === orgId);
  if (idx >= 0) inMemoryServices.splice(idx, 1);
  res.json({ success: true });
});

// POST /api/organizations/switch - Switch active organization for user session
app.post('/api/organizations/switch', requireAuth, async (req: Request, res: Response) => {
  const { organizationId } = req.body;
  if (!organizationId) {
    return res.status(400).json({ error: 'Target organizationId required' });
  }

  const userId = req.user!.id;

  if (pool) {
    try {
      const orgCheck = await pool.query('SELECT id, name FROM public.organizations WHERE id = $1;', [organizationId]);
      if (orgCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Organization does not exist' });
      }
      await pool.query('UPDATE public.users SET organization_id = $1 WHERE id = $2;', [organizationId, userId]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  } else {
    const org = inMemoryOrgs.find(o => o.id === organizationId);
    if (!org) return res.status(404).json({ error: 'Organization does not exist' });
    const user = inMemoryUsers.find(u => u.id === userId);
    if (user) user.organizationId = organizationId;
  }

  const newToken = createSessionToken({
    userId,
    email: req.user!.email,
    organizationId,
    role: req.user!.role,
  });
  setSessionCookie(res, newToken);

  res.json({ success: true, organizationId });
});

// Helper to normalize phone numbers for consistent matching
function normalizePhone(p?: string | null): string {
  if (!p) return '';
  return p.replace(/\D/g, '');
}

// Helper to look up organization by Twilio phone number
async function findOrgByTwilioNumber(twilioNumber?: string) {
  const normalized = normalizePhone(twilioNumber);
  if (pool) {
    try {
      if (normalized) {
        const res = await pool.query(
          `SELECT * FROM public.organizations 
           WHERE regexp_replace(twilio_phone_number, '[^0-9]', '', 'g') = $1 
              OR twilio_phone_number = $2 
           LIMIT 1;`,
          [normalized, twilioNumber || '']
        );
        if (res.rows.length > 0) return res.rows[0];
      }
      // Fallback to first registered organization
      const fallback = await pool.query('SELECT * FROM public.organizations ORDER BY created_at ASC LIMIT 1;');
      return fallback.rows[0] || null;
    } catch (e) {
      console.warn('Error querying organization by twilio number:', e);
    }
  }

  // In-memory fallback
  const match = inMemoryOrgs.find(o => normalizePhone(o.twilioPhoneNumber) === normalized || o.twilioPhoneNumber === twilioNumber);
  return match || inMemoryOrgs[0] || null;
}

// Helper to retrieve organization context (settings, services, bookings)
async function getOrgContext(orgId: string) {
  if (pool) {
    try {
      const [settingsRes, servicesRes, bookingsRes] = await Promise.all([
        pool.query('SELECT * FROM public.assistant_settings WHERE organization_id = $1;', [orgId]),
        pool.query('SELECT * FROM public.services WHERE organization_id = $1 ORDER BY created_at ASC;', [orgId]),
        pool.query('SELECT * FROM public.job_bookings WHERE organization_id = $1 ORDER BY scheduled_date DESC LIMIT 10;', [orgId]),
      ]);

      const s = settingsRes.rows[0];
      const settings = s ? {
        aiTone: s.ai_tone,
        autoConfirmRoutine: s.auto_confirm_routine,
        bufferMinutesBetweenJobs: s.buffer_minutes_between_jobs,
        workingHours: {
          start: s.working_hours_start?.slice(0, 5) || '07:30',
          end: s.working_hours_end?.slice(0, 5) || '17:30',
          workWeekends: s.work_weekends,
        },
        emergencyKeywords: s.emergency_keywords || [],
        llmProvider: s.llm_provider || 'openai_compatible',
        openaiBaseUrl: s.openai_base_url || DEFAULT_OPENAI_BASE_URL,
        openaiApiKey: s.openai_api_key || DEFAULT_OPENAI_API_KEY,
        openaiModel: s.openai_model || DEFAULT_OPENAI_MODEL,
      } : {};

      const services = servicesRes.rows.map(srv => ({
        id: srv.id,
        title: srv.title,
        trade: srv.trade,
        durationHours: parseFloat(srv.duration_hours) || 1.5,
        basePrice: parseFloat(srv.base_price) || 195,
        description: srv.description || '',
      }));

      const bookings = bookingsRes.rows.map(b => ({
        id: b.id,
        customerName: b.customer_name,
        date: typeof b.scheduled_date === 'string' ? b.scheduled_date.slice(0, 10) : new Date(b.scheduled_date).toISOString().slice(0, 10),
        timeSlot: b.time_slot,
        status: b.status,
      }));

      return { settings, services, bookings };
    } catch (e) {
      console.warn('Error fetching org context:', e);
    }
  }

  const settings = inMemorySettings[orgId] || inMemorySettings[inMemoryOrgs[0].id] || {};
  const services = inMemoryServices.filter(s => s.organizationId === orgId);
  const bookings = inMemoryBookings.filter(b => b.organizationId === orgId);
  return { settings, services, bookings };
}

export interface RunSmsAssistantOptions {
  incomingText: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  conversationHistory?: Array<{ sender: string; text: string }>;
  existingBookings?: any[];
  services?: any[];
  settings?: any;
}

export interface SmsAssistantResult {
  source: string;
  replyText: string;
  intent: 'book' | 'reschedule' | 'cancel' | 'inquiry' | 'emergency' | 'confirm';
  urgency: 'routine' | 'urgent' | 'emergency';
  actionTag: 'auto_booked' | 'rescheduled' | 'quote_given' | 'emergency_escalated' | 'slot_offered' | 'info_requested';
  serviceTitle: string | null;
  suggestedSlot: string | null;
  extractedAddress: string | null;
  estimatedPrice: number;
  shouldConfirmBooking: boolean;
  model?: string;
}

// Shared SMS Assistant Pipeline (OpenAI-compatible -> Gemini -> Rule-based fallback)
export async function runSmsAssistant(options: RunSmsAssistantOptions): Promise<SmsAssistantResult> {
  const {
    incomingText,
    customerName,
    customerPhone,
    address,
    conversationHistory = [],
    existingBookings = [],
    services = [],
    settings = {},
  } = options;

  let parsedResult: any = null;

  const prompt = `
Context:
- Business: ${settings.businessName || 'Apex Trades'}
- Tradesperson: ${settings.tradespersonName || 'Mark'} (${settings.tradeType || 'plumbing'})
- Customer Name: ${customerName || 'Customer'}
- Customer Phone: ${customerPhone || 'Unknown'}
- Known Customer Address: ${address || 'Not yet provided'}
- Today's Date: ${new Date().toISOString().split('T')[0]}
- Available Services: ${JSON.stringify(services.map((s: any) => ({ title: s.title, price: s.basePrice, durationHours: s.durationHours })))}
- Recent Bookings: ${JSON.stringify(existingBookings.map((b: any) => ({ id: b.id, name: b.customerName, date: b.date, slot: b.timeSlot, status: b.status })))}

Conversation history so far:
${conversationHistory.map((m: any) => `${m.sender === 'customer' ? 'Customer' : 'Assistant'}: ${m.text}`).join('\n')}

New incoming SMS from customer:
"${incomingText}"

Analyze this message, determine the intent, formulate the optimal SMS response, and extract structured data.
You MUST return a JSON object with the following schema:
{
  "replyText": "exact SMS text string under 300 characters, friendly and direct",
  "intent": "book" | "reschedule" | "cancel" | "inquiry" | "emergency" | "confirm",
  "urgency": "routine" | "urgent" | "emergency",
  "actionTag": "auto_booked" | "rescheduled" | "quote_given" | "emergency_escalated" | "slot_offered" | "info_requested",
  "serviceTitle": "matched service title or null",
  "suggestedSlot": "proposed slot or confirmed slot e.g. Tomorrow 09:00 AM - 11:00 AM or null",
  "extractedAddress": "address extracted from message if any or null",
  "estimatedPrice": number,
  "shouldConfirmBooking": boolean (true if slot explicitly confirmed/booked/rescheduled)
}`;

  const preferredProvider = settings.llmProvider || (settings.openaiApiKey || DEFAULT_OPENAI_API_KEY ? 'openai_compatible' : 'gemini');

  if (preferredProvider === 'openai_compatible') {
    try {
      const rawContent = await callOpenAiCompatibleChat({
        baseUrl: settings.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL,
        apiKey: settings.openaiApiKey || DEFAULT_OPENAI_API_KEY,
        model: settings.openaiModel || DEFAULT_OPENAI_MODEL,
        systemPrompt: RIDGELINE_SYSTEM_PROMPT,
        userPrompt: prompt,
        jsonMode: true,
      });

      const cleaned = rawContent.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleaned);
      parsedResult.source = 'openai_compatible';
      parsedResult.model = settings.openaiModel || DEFAULT_OPENAI_MODEL;
    } catch (openAiErr: any) {
      console.warn('OpenAI-compatible call failed, falling back:', openAiErr.message);
    }
  }

  // Secondary fallback: Gemini SDK if available
  if (!parsedResult && ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: RIDGELINE_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              replyText: {
                type: Type.STRING,
                description: 'The exact SMS text message to send back to the customer (keep under 300 characters, friendly and direct).',
              },
              intent: {
                type: Type.STRING,
                enum: ['book', 'reschedule', 'cancel', 'inquiry', 'emergency', 'confirm'],
                description: 'Primary customer intent',
              },
              urgency: {
                type: Type.STRING,
                enum: ['routine', 'urgent', 'emergency'],
                description: 'Urgency tier of the job',
              },
              actionTag: {
                type: Type.STRING,
                enum: ['auto_booked', 'rescheduled', 'quote_given', 'emergency_escalated', 'slot_offered', 'info_requested'],
                description: 'Action taken by the assistant',
              },
              serviceTitle: {
                type: Type.STRING,
                description: 'Matched trade service title, if determined.',
              },
              suggestedSlot: {
                type: Type.STRING,
                description: 'Proposed or confirmed time slot e.g. "Tomorrow 09:00 AM - 11:00 AM"',
              },
              extractedAddress: {
                type: Type.STRING,
                description: 'Address extracted from text if provided.',
              },
              estimatedPrice: {
                type: Type.NUMBER,
                description: 'Estimated dollar cost based on service catalog, or 0 if unknown.',
              },
              shouldConfirmBooking: {
                type: Type.BOOLEAN,
                description: 'True if a new booking or slot was explicitly agreed upon and should be added/updated in the schedule.',
              },
            },
            required: ['replyText', 'intent', 'urgency', 'actionTag', 'shouldConfirmBooking'],
          },
        },
      });

      parsedResult = JSON.parse(response.text?.trim() || '{}');
      parsedResult.source = 'gemini';
    } catch (geminiErr: any) {
      console.warn('Gemini call failed, falling back to rule-based engine:', geminiErr.message);
    }
  }

  if (!parsedResult) {
    // Deterministic rule-based fallback
    const lower = incomingText.toLowerCase();
    let intent: 'book' | 'reschedule' | 'cancel' | 'inquiry' | 'emergency' | 'confirm' = 'inquiry';
    let urgency: 'routine' | 'urgent' | 'emergency' = 'routine';
    let actionTag: 'auto_booked' | 'rescheduled' | 'quote_given' | 'emergency_escalated' | 'slot_offered' | 'info_requested' = 'info_requested';
    const techName = settings.tradespersonName || 'Mark';
    let replyText = `Thanks for reaching out! ${techName} is on a service call. Can you share what issue you're experiencing and your address?`;
    let shouldConfirmBooking = false;
    let suggestedSlot = 'Tomorrow 10:00 AM - 12:00 PM';
    let estimatedPrice = 250;
    let serviceTitle = 'General Service Diagnostic';

    if (lower.includes('flood') || lower.includes('burst') || lower.includes('leak') || lower.includes('sewage') || lower.includes('emergency')) {
      intent = 'emergency';
      urgency = 'emergency';
      actionTag = 'emergency_escalated';
      replyText = `Understood, this is urgent! Please locate and shut off the main water shutoff valve clockwise immediately. ${techName} can dispatch to you today at 1:30 PM. What is your street address?`;
      suggestedSlot = 'Today 01:30 PM - 03:30 PM';
      estimatedPrice = 380;
      serviceTitle = 'Emergency Burst Pipe & Valve Shutoff';
    } else if (lower.includes('reschedule') || lower.includes('push to') || lower.includes('move to') || lower.includes('another day') || lower.includes('can we do')) {
      intent = 'reschedule';
      urgency = 'routine';
      actionTag = 'rescheduled';
      shouldConfirmBooking = true;
      suggestedSlot = 'Tomorrow 09:00 AM - 11:00 AM';
      replyText = `No problem at all! I have updated ${techName}'s schedule and moved your appointment to tomorrow from 9:00 AM - 11:00 AM. See you then!`;
    } else if (lower.includes('yes') || lower.includes('sounds good') || lower.includes('perfect') || lower.includes('confirm') || lower.includes('book it')) {
      intent = 'confirm';
      actionTag = 'auto_booked';
      shouldConfirmBooking = true;
      replyText = `You're all set! We have you confirmed on ${techName}'s dispatch schedule for tomorrow 09:00 AM - 11:00 AM. ${techName} will text when en route!`;
    } else if (lower.includes('how much') || lower.includes('cost') || lower.includes('quote') || lower.includes('price')) {
      intent = 'inquiry';
      actionTag = 'quote_given';
      replyText = `Our standard diagnostic & basic service call is $195-$285 depending on parts required. ${techName} has an opening tomorrow morning at 9:00 AM or 1:00 PM if you'd like a slot!`;
    }

    parsedResult = {
      source: 'fallback',
      replyText,
      intent,
      urgency,
      actionTag,
      serviceTitle,
      suggestedSlot,
      extractedAddress: address || '',
      estimatedPrice,
      shouldConfirmBooking,
    };
  }

  return parsedResult;
}

// API: Process incoming SMS (Simulator & Client)
// Authenticated + rate limited: this endpoint runs the LLM pipeline, so leaving
// it public let anyone burn provider credits anonymously. The only caller is
// src/App.tsx handleProcessCustomerSms, which renders exclusively inside
// <ProtectedRoute> and goes through apiFetch (credentials: 'include' + Bearer).
app.post(
  '/api/sms/process',
  requireAuth,
  rateLimitPerOrg({ scope: 'sms-process' }),
  async (req: Request, res: Response) => {
  try {
    const {
      incomingText,
      customerName,
      customerPhone,
      address,
      conversationHistory = [],
      existingBookings = [],
      services = [],
      settings = {},
    } = req.body;

    if (!incomingText) {
      return res.status(400).json({ error: 'incomingText is required' });
    }

    // `settings` is client-supplied and is fed straight into the LLM pipeline
    // (provider, base URL, API key). Leaving those client-writable would
    // re-create the SSRF primitive that the test-endpoint route used to expose,
    // so they are dropped here and the server falls back to env-driven config.
    const safeSettings = stripServerOnlyAssistantKeys(settings);

    const result = await runSmsAssistant({
      incomingText,
      customerName,
      customerPhone,
      address,
      conversationHistory,
      existingBookings,
      services,
      settings: safeSettings,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error in /api/sms/process:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ==========================================
// TWILIO TELEPHONY & DISPATCH WEBHOOKS
// ==========================================

// Real incoming SMS from a customer via Twilio
app.post('/webhooks/twilio/sms', twilioFormParser, verifyTwilioSignature, async (req: Request, res: Response) => {
  const from = req.body.From;   // customer's phone number e.g. +15551234567
  const to = req.body.To;       // your Twilio number dialed
  const body = req.body.Body || '';

  try {
    const org = await findOrgByTwilioNumber(to);
    if (!org) {
      console.warn('No organization found for Twilio number:', to);
      const twiml = new MessagingResponse();
      twiml.message("RidgeLine Dispatch: Service currently offline for this number.");
      return res.type('text/xml').send(twiml.toString());
    }

    const orgId = org.id;
    const { settings, services, bookings } = await getOrgContext(orgId);

    // Look up or initialize customer
    let customerName = 'Customer';
    let customerAddress = '';
    let threadId: string;
    let history: Array<{ sender: string; text: string }> = [];

    if (pool) {
      // Lookup customer
      const custRes = await pool.query(
        'SELECT * FROM public.customers WHERE organization_id = $1 AND phone = $2 LIMIT 1;',
        [orgId, from]
      );
      if (custRes.rows.length > 0) {
        customerName = custRes.rows[0].name;
        customerAddress = custRes.rows[0].address || '';
      }

      // Lookup or create SMS thread
      const thrdRes = await pool.query(
        'SELECT * FROM public.sms_threads WHERE organization_id = $1 AND customer_phone = $2 LIMIT 1;',
        [orgId, from]
      );

      if (thrdRes.rows.length > 0) {
        const t = thrdRes.rows[0];
        threadId = t.id;
        if (!customerAddress && t.address) customerAddress = t.address;
        if (customerName === 'Customer' && t.customer_name) customerName = t.customer_name;

        // Fetch recent message history for context
        const msgRes = await pool.query(
          'SELECT sender, text FROM public.sms_messages WHERE thread_id = $1 ORDER BY created_at ASC LIMIT 12;',
          [threadId]
        );
        history = msgRes.rows;
      } else {
        threadId = crypto.randomUUID ? crypto.randomUUID() : toUuid(`tw-th-${from}-${Date.now()}`);
        await pool.query(
          `INSERT INTO public.sms_threads (
            id, organization_id, customer_name, customer_phone, address, trade_type, status, last_activity_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW());`,
          [threadId, orgId, customerName, from, customerAddress, org.trade || 'plumbing']
        );
      }
    } else {
      // In-memory fallback
      let memCust = inMemoryCustomers.find(c => c.organizationId === orgId && c.phone === from);
      if (memCust) {
        customerName = memCust.name;
        customerAddress = memCust.address || '';
      }

      let memThread = inMemoryThreads.find(t => t.organizationId === orgId && t.customerPhone === from);
      if (!memThread) {
        threadId = `th-tw-${Date.now()}`;
        memThread = {
          id: threadId,
          organizationId: orgId,
          customerName,
          customerPhone: from,
          address: customerAddress,
          tradeType: org.trade || 'plumbing',
          unreadCount: 0,
          status: 'active',
          lastActivityAt: new Date().toISOString(),
        };
        inMemoryThreads.unshift(memThread);
      } else {
        threadId = memThread.id;
        if (!customerAddress && memThread.address) customerAddress = memThread.address;
      }

      history = inMemoryMessages.filter(m => m.threadId === threadId).slice(-12).map(m => ({ sender: m.sender, text: m.text }));
    }

    // Run AI / Assistant logic
    const assistantResult = await runSmsAssistant({
      incomingText: body,
      customerName,
      customerPhone: from,
      address: customerAddress,
      conversationHistory: history,
      existingBookings: bookings,
      services,
      settings: {
        ...settings,
        businessName: org.name,
        tradespersonName: org.technician_name || org.technicianName || 'Mark',
        tradeType: org.trade || 'plumbing',
      },
    });

    // Persist incoming customer message and outgoing assistant reply
    if (pool) {
      await pool.query(
        `INSERT INTO public.sms_messages (thread_id, sender, text, action_tag)
         VALUES ($1, 'customer', $2, null);`,
        [threadId, body]
      );

      await pool.query(
        `INSERT INTO public.sms_messages (thread_id, sender, text, action_tag, parsed_intent)
         VALUES ($1, 'assistant', $2, $3, $4);`,
        [threadId, assistantResult.replyText, assistantResult.actionTag, JSON.stringify(assistantResult)]
      );

      await pool.query(
        'UPDATE public.sms_threads SET last_activity_at = NOW(), status = $1 WHERE id = $2;',
        [assistantResult.shouldConfirmBooking ? 'booked' : 'active', threadId]
      );

      // Handle booking confirmation or reschedule
      if (assistantResult.shouldConfirmBooking) {
        if (assistantResult.intent === 'reschedule') {
          const nextDay = new Date(Date.now() + 86400000).toISOString().split('T')[0];
          const slot = assistantResult.suggestedSlot || '09:00 AM - 11:00 AM';
          await pool.query(
            `UPDATE public.job_bookings SET scheduled_date = $1, time_slot = $2, notes = notes || ' (Rescheduled via Twilio SMS)'
             WHERE sms_thread_id = $3 AND organization_id = $4;`,
            [nextDay, slot, threadId, orgId]
          );
        } else {
          const bookingDate = new Date().toISOString().split('T')[0];
          const slot = assistantResult.suggestedSlot || '01:30 PM - 03:30 PM';
          const bkRes = await pool.query(
            `INSERT INTO public.job_bookings (
              organization_id, customer_name, customer_phone, address, trade_type,
              service_title, scheduled_date, time_slot, status, estimate_amount,
              notes, urgency, created_from, sms_thread_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9, $10, $11, 'sms', $12)
            RETURNING id;`,
            [
              orgId,
              customerName,
              from,
              assistantResult.extractedAddress || customerAddress || 'Address requested via SMS',
              org.trade || 'plumbing',
              assistantResult.serviceTitle || 'General Diagnostic & Repair',
              bookingDate,
              slot,
              assistantResult.estimatedPrice || 250,
              'Auto-confirmed by RidgeLine AI Assistant via live Twilio SMS webhook.',
              assistantResult.urgency || 'routine',
              threadId,
            ]
          );
          if (bkRes.rows[0]?.id) {
            await pool.query('UPDATE public.sms_threads SET booking_id = $1 WHERE id = $2;', [bkRes.rows[0].id, threadId]);
          }
        }
      }
    } else {
      // In-memory message persistence
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      inMemoryMessages.push({
        id: `msg-${Date.now()}-1`,
        threadId,
        sender: 'customer',
        text: body,
        timestamp: nowStr,
        status: 'delivered',
      });
      inMemoryMessages.push({
        id: `msg-${Date.now()}-2`,
        threadId,
        sender: 'assistant',
        text: assistantResult.replyText,
        timestamp: nowStr,
        status: 'delivered',
        actionTag: assistantResult.actionTag,
      });

      if (assistantResult.shouldConfirmBooking) {
        inMemoryBookings.unshift({
          id: `bk-tw-${Date.now().toString().slice(-4)}`,
          organizationId: orgId,
          customerName,
          customerPhone: from,
          address: assistantResult.extractedAddress || customerAddress || 'Address pending',
          tradeType: org.trade || 'plumbing',
          serviceTitle: assistantResult.serviceTitle || 'General Diagnostic & Repair',
          date: new Date().toISOString().split('T')[0],
          timeSlot: assistantResult.suggestedSlot || '01:30 PM - 03:30 PM',
          status: 'scheduled',
          estimateAmount: assistantResult.estimatedPrice || 250,
          notes: 'Auto-confirmed via live Twilio SMS webhook.',
          urgency: assistantResult.urgency || 'routine',
          createdFrom: 'sms',
          smsThreadId: threadId,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Return TwiML
    const twiml = new MessagingResponse();
    twiml.message(assistantResult.replyText);
    res.type('text/xml').send(twiml.toString());
  } catch (err: any) {
    console.error('Twilio SMS webhook error:', err);
    const twiml = new MessagingResponse();
    twiml.message("Sorry, something went wrong on our end — we'll follow up shortly.");
    res.type('text/xml').send(twiml.toString());
  }
});

// Incoming call — forwards to tradesperson's real mobile with a 15-second timeout
app.post('/webhooks/twilio/voice', twilioFormParser, verifyTwilioSignature, async (req: Request, res: Response) => {
  const to = req.body.To;
  const org = await findOrgByTwilioNumber(to);
  const forwardTo = org?.forward_calls_to || org?.forwardCallsTo || FORWARD_CALLS_TO;

  const twiml = new VoiceResponse();
  const dial = twiml.dial({
    timeout: 15, // seconds before it's considered unanswered
    action: '/webhooks/twilio/voice-status',
    method: 'POST',
  });
  dial.number(forwardTo);
  res.type('text/xml').send(twiml.toString());
});

// Twilio calls this back after the <Dial> completes (answered, no-answer, busy, failed, canceled)
app.post('/webhooks/twilio/voice-status', twilioFormParser, verifyTwilioSignature, async (req: Request, res: Response) => {
  const dialStatus = req.body.DialCallStatus; // 'completed' | 'no-answer' | 'busy' | 'failed' | 'canceled'
  const from = req.body.From;
  const to = req.body.To;
  const duration = parseInt(req.body.DialCallDuration || req.body.CallDuration || '15', 10);

  if (dialStatus !== 'completed') {
    // This is the actual missed-call-to-textback trigger
    try {
      const org = await findOrgByTwilioNumber(to);
      const orgId = org?.id || inMemoryOrgs[0].id;
      const techName = org?.technician_name || org?.technicianName || 'Mark';
      const bizName = org?.name || 'Apex Plumbing & Mechanical';

      const autoSms = `Hey! This is the dispatcher for ${techName} at ${bizName}. ${techName} is currently on a job and can't pick up. What issue are you experiencing today? Reply here and I'll get you on the schedule!`;

      // Trigger instant outbound SMS via Twilio API if credentials are configured
      if (twilioClient) {
        await twilioClient.messages.create({
          from: to,
          to: from,
          body: autoSms,
        }).catch((err: any) => console.warn('Twilio instant textback failed:', err.message));
      }

      // Persist missed call to database or in-memory
      if (pool) {
        await pool.query(
          `INSERT INTO public.missed_calls (
            organization_id, caller_name, caller_phone, ring_duration_seconds,
            auto_sms_sent, auto_sms_sent_at, converted_to_booking
          ) VALUES ($1, $2, $3, $4, true, NOW(), false);`,
          [orgId, 'Caller', from, duration || 15]
        );

        // Ensure an SMS thread exists for this customer so the follow-up text is visible in SMS inbox
        const thCheck = await pool.query(
          'SELECT id FROM public.sms_threads WHERE organization_id = $1 AND customer_phone = $2 LIMIT 1;',
          [orgId, from]
        );

        let threadId: string;
        if (thCheck.rows.length === 0) {
          threadId = crypto.randomUUID ? crypto.randomUUID() : toUuid(`mc-th-${from}-${Date.now()}`);
          await pool.query(
            `INSERT INTO public.sms_threads (
              id, organization_id, customer_name, customer_phone, trade_type, status, last_activity_at
            ) VALUES ($1, $2, 'Caller', $3, $4, 'active', NOW());`,
            [threadId, orgId, from, org?.trade || 'plumbing']
          );
        } else {
          threadId = thCheck.rows[0].id;
          await pool.query('UPDATE public.sms_threads SET last_activity_at = NOW() WHERE id = $1;', [threadId]);
        }

        // Record the outbound auto-SMS in the thread
        await pool.query(
          `INSERT INTO public.sms_messages (thread_id, sender, text, action_tag)
           VALUES ($1, 'assistant', $2, 'slot_offered');`,
          [threadId, autoSms]
        );
      } else {
        inMemoryCalls.unshift({
          id: `mc-${Date.now()}`,
          organizationId: orgId,
          callerName: 'Caller',
          callerPhone: from,
          ringDurationSeconds: duration || 15,
          autoSmsSent: true,
          convertedToBooking: false,
          urgency: 'routine',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.error('Error handling missed call textback:', e);
    }
  }

  res.type('text/xml').send(new VoiceResponse().toString());
});

// API: Process simulated missed call to auto-SMS
// Authenticated + rate limited for the same reason as /api/sms/process: it
// runs an LLM call. No live client caller exists (the simulate-call modal is
// never mounted and issues no fetch); the URL shown in SettingsView is display
// text only, and real inbound calls arrive via /webhooks/twilio/voice.
app.post(
  '/api/missed-call/process',
  requireAuth,
  rateLimitPerOrg({ scope: 'missed-call-process' }),
  async (req: Request, res: Response) => {
  try {
    const { callerName, callerPhone, voicemailTranscript, settings: rawSettings = {} } = req.body;
    // Drop client-supplied LLM provider/base URL/API key — see /api/sms/process.
    const settings = stripServerOnlyAssistantKeys(rawSettings);

    let autoSms = `Hey ${callerName || 'there'}! Mark with ${settings.businessName || 'Apex Plumbing'} here. I'm currently on a service call and couldn't grab the phone. Need help with a plumbing or mechanical issue? Reply here and I'll get you on the schedule!`;

    if (voicemailTranscript) {
      const preferredProvider = settings.llmProvider || (settings.openaiApiKey || DEFAULT_OPENAI_API_KEY ? 'openai_compatible' : 'gemini');
      const prompt = `A customer left this voicemail after a missed call: "${voicemailTranscript}".
Tradesperson: ${settings.tradespersonName || 'Mark'} with ${settings.businessName || 'Apex Plumbing'}.
Draft the immediate follow-up SMS text to send them within 10 seconds to secure the booking before they call a competitor.
Keep it under 240 chars, friendly, acknowledging what they mentioned in the voicemail. Reply with ONLY the SMS text message content.`;

      let generated = false;

      if (preferredProvider === 'openai_compatible') {
        try {
          const resText = await callOpenAiCompatibleChat({
            baseUrl: settings.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL,
            apiKey: settings.openaiApiKey || DEFAULT_OPENAI_API_KEY,
            model: settings.openaiModel || DEFAULT_OPENAI_MODEL,
            systemPrompt: RIDGELINE_SYSTEM_PROMPT,
            userPrompt: prompt,
            jsonMode: false,
          });
          if (resText?.trim()) {
            autoSms = resText.trim().replace(/^["']|["']$/g, '');
            generated = true;
          }
        } catch (e: any) {
          console.warn('OpenAI compatible missed call text failed:', e.message);
        }
      }

      if (!generated && ai) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
          });
          if (response.text?.trim()) {
            autoSms = response.text.trim();
          }
        } catch (err: any) {
          console.warn('Gemini missed call text failed:', err.message);
        }
      }
    }

    // Persist missed call to Neon if pool available
    if (pool) {
      try {
        const orgRes = await pool.query('SELECT id FROM public.organizations LIMIT 1;');
        const orgId = orgRes.rows[0]?.id;
        if (orgId) {
          await pool.query(
            `INSERT INTO public.missed_calls (
              organization_id, caller_name, caller_phone, ring_duration_seconds,
              voicemail_transcript, auto_sms_sent, auto_sms_sent_at, converted_to_booking
            ) VALUES ($1, $2, $3, $4, $5, true, NOW(), false);`,
            [orgId, callerName || 'Customer', callerPhone || '+1 (555) 000-0000', 18, voicemailTranscript || null]
          );
        }
      } catch (err: any) {
        console.warn('Neon missed call insert failed:', err.message);
      }
    }

    return res.json({ autoSms });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
  }
);
// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!apiKey,
    openaiCompatibleConfigured: !!DEFAULT_OPENAI_API_KEY,
    openaiEndpoint: DEFAULT_OPENAI_BASE_URL,
    openaiDefaultModel: DEFAULT_OPENAI_MODEL,
    neonConfigured: !!pool,
    platform: 'RidgeLine AI Dispatch',
  });
});

// Initialize database tables, tenant-scoped RLS policies, and application role if they don't exist
async function initDb() {
  if (!pool) return;
  try {
    // 1. Setup app schema and tenant context functions
    await pool.query(`
      CREATE SCHEMA IF NOT EXISTS app;

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

      GRANT USAGE ON SCHEMA public, app TO ridgeline_app;
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ridgeline_app;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ridgeline_app;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO ridgeline_app;
    `);

    // 2. Ensure customers and users tables exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        email VARCHAR(255),
        address TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_org ON public.customers (organization_id, phone);
      CREATE INDEX IF NOT EXISTS idx_customers_org ON public.customers (organization_id);

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
      CREATE INDEX IF NOT EXISTS idx_users_org ON public.users (organization_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
    `);

    // 3. Enable and FORCE Row Level Security on all tenant tables
    await pool.query(`
      ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

      ALTER TABLE public.assistant_settings ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.assistant_settings FORCE ROW LEVEL SECURITY;

      ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.services FORCE ROW LEVEL SECURITY;

      ALTER TABLE public.job_bookings ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.job_bookings FORCE ROW LEVEL SECURITY;

      ALTER TABLE public.sms_threads ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.sms_threads FORCE ROW LEVEL SECURITY;

      ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.sms_messages FORCE ROW LEVEL SECURITY;

      ALTER TABLE public.missed_calls ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.missed_calls FORCE ROW LEVEL SECURITY;

      ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;

      ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
    `);

    // 4. Drop old wide-open policies and apply tenant-scoped policies
    await pool.query(`
      DROP POLICY IF EXISTS "Full access for authenticated users on organizations" ON public.organizations;
      DROP POLICY IF EXISTS "Full access for authenticated users on assistant_settings" ON public.assistant_settings;
      DROP POLICY IF EXISTS "Full access for authenticated users on services" ON public.services;
      DROP POLICY IF EXISTS "Full access for authenticated users on job_bookings" ON public.job_bookings;
      DROP POLICY IF EXISTS "Full access for authenticated users on sms_threads" ON public.sms_threads;
      DROP POLICY IF EXISTS "Full access for authenticated users on sms_messages" ON public.sms_messages;
      DROP POLICY IF EXISTS "Full access for authenticated users on missed_calls" ON public.missed_calls;
      DROP POLICY IF EXISTS "Full access for authenticated users on customers" ON public.customers;
      DROP POLICY IF EXISTS "Full access for authenticated users on users" ON public.users;

      DROP POLICY IF EXISTS "Tenant isolation for organizations" ON public.organizations;
      CREATE POLICY "Tenant isolation for organizations"
        ON public.organizations FOR ALL
        USING (id = app.current_organization_id())
        WITH CHECK (id = app.current_organization_id());

      DROP POLICY IF EXISTS "Tenant isolation for assistant_settings" ON public.assistant_settings;
      CREATE POLICY "Tenant isolation for assistant_settings"
        ON public.assistant_settings FOR ALL
        USING (organization_id = app.current_organization_id())
        WITH CHECK (organization_id = app.current_organization_id());

      DROP POLICY IF EXISTS "Tenant isolation for services" ON public.services;
      CREATE POLICY "Tenant isolation for services"
        ON public.services FOR ALL
        USING (organization_id = app.current_organization_id())
        WITH CHECK (organization_id = app.current_organization_id());

      DROP POLICY IF EXISTS "Tenant isolation for job_bookings" ON public.job_bookings;
      CREATE POLICY "Tenant isolation for job_bookings"
        ON public.job_bookings FOR ALL
        USING (organization_id = app.current_organization_id())
        WITH CHECK (organization_id = app.current_organization_id());

      DROP POLICY IF EXISTS "Tenant isolation for sms_threads" ON public.sms_threads;
      CREATE POLICY "Tenant isolation for sms_threads"
        ON public.sms_threads FOR ALL
        USING (organization_id = app.current_organization_id())
        WITH CHECK (organization_id = app.current_organization_id());

      DROP POLICY IF EXISTS "Tenant isolation for sms_messages" ON public.sms_messages;
      CREATE POLICY "Tenant isolation for sms_messages"
        ON public.sms_messages FOR ALL
        USING (thread_id IN (SELECT id FROM public.sms_threads WHERE organization_id = app.current_organization_id()))
        WITH CHECK (thread_id IN (SELECT id FROM public.sms_threads WHERE organization_id = app.current_organization_id()));

      DROP POLICY IF EXISTS "Tenant isolation for missed_calls" ON public.missed_calls;
      CREATE POLICY "Tenant isolation for missed_calls"
        ON public.missed_calls FOR ALL
        USING (organization_id = app.current_organization_id())
        WITH CHECK (organization_id = app.current_organization_id());

      DROP POLICY IF EXISTS "Tenant isolation for customers" ON public.customers;
      CREATE POLICY "Tenant isolation for customers"
        ON public.customers FOR ALL
        USING (organization_id = app.current_organization_id())
        WITH CHECK (organization_id = app.current_organization_id());

      DROP POLICY IF EXISTS "Tenant isolation for users" ON public.users;
      CREATE POLICY "Tenant isolation for users"
        ON public.users FOR ALL
        USING (organization_id = app.current_organization_id() OR id = app.current_user_id())
        WITH CHECK (organization_id = app.current_organization_id() OR id = app.current_user_id());
    `);

    console.log('Database tables, tenant-scoped RLS policies, and application role initialized successfully.');
  } catch (err: any) {
    console.error('Failed to initialize database tables and RLS policies:', err.message);
  }
}

// Vite Middleware for development vs Static files in production
async function startServer() {
  await initDb();

  // Unmatched /api/* paths must fail as JSON, never fall through to the SPA.
  // Every /api/* route is registered at module load (before startServer runs),
  // so anything still reaching here is genuinely unknown. In dev the Vite
  // middleware (appType: 'spa') and in production the app.get('*') catch-all
  // would otherwise answer an unknown API path with index.html + HTTP 200,
  // making a missing endpoint indistinguishable from a successful call.
  // This sits above both so dev and production behave identically.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/')) {
      return next();
    }
    return res.status(404).json({
      error: `No API route matches ${req.method} ${req.path}`,
      method: req.method,
      path: req.path,
      hint: 'Check the path and HTTP method against the /api/* routes in server.ts.',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RidgeLine server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
