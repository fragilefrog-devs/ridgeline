-- ==============================================================================
-- RidgeLine - AI Scheduling & Dispatch Assistant
-- Migration: 20260927000000_init_ridgeline_schema.sql
-- Target: Supabase / PostgreSQL 15+
-- Features: Full multi-tenant schema, Twilio SMS tracking, Missed-Call conversion,
--           Realtime replication, Row-Level Security (RLS), Triggers & Seed Data.
-- ==============================================================================

-- 1. Enable Required Extensions & Schemas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS app;

-- Tenant context helper functions
CREATE OR REPLACE FUNCTION app.current_organization_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_organization_id', true), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Dedicated application role for executing tenant queries under RLS
DO $$ BEGIN
    CREATE ROLE ridgeline_app WITH NOLOGIN;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

GRANT USAGE ON SCHEMA public, app TO ridgeline_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ridgeline_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ridgeline_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO ridgeline_app;

-- ==============================================================================
-- 2. Custom Enumerations
-- ==============================================================================

DO $$ BEGIN
    CREATE TYPE trade_type AS ENUM (
        'plumbing',
        'electrical',
        'hvac',
        'locksmith',
        'general'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM (
        'scheduled',
        'en_route',
        'in_progress',
        'completed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE urgency_level AS ENUM (
        'routine',
        'urgent',
        'emergency'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE booking_origin AS ENUM (
        'sms',
        'missed_call',
        'manual'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE thread_status AS ENUM (
        'active',
        'booked',
        'rescheduled',
        'closed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_sender AS ENUM (
        'customer',
        'assistant',
        'tradesperson'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_status AS ENUM (
        'sent',
        'delivered',
        'read',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE action_tag AS ENUM (
        'auto_booked',
        'rescheduled',
        'quote_given',
        'emergency_escalated',
        'slot_offered',
        'info_requested'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ai_tone_type AS ENUM (
        'friendly_direct',
        'ultra_professional',
        'concise_fast'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 3. Core Tables
-- ==============================================================================

-- 3.1 Organizations / Workspaces (Solo Tradesperson Business)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    trade trade_type NOT NULL DEFAULT 'plumbing',
    technician_name VARCHAR(150) NOT NULL,
    license_number VARCHAR(100),
    service_radius_miles INTEGER DEFAULT 25 CHECK (service_radius_miles > 0),
    business_address TEXT,
    email VARCHAR(255),
    plan VARCHAR(50) DEFAULT 'Solo Pro',
    twilio_phone_number VARCHAR(30) NOT NULL,
    forward_calls_to VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.organizations IS 'Tenant workspaces for solo contractors and trades businesses.';

-- 3.2 AI Assistant Dispatcher Settings per Organization
CREATE TABLE IF NOT EXISTS public.assistant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    ai_tone ai_tone_type NOT NULL DEFAULT 'friendly_direct',
    auto_confirm_routine BOOLEAN NOT NULL DEFAULT true,
    buffer_minutes_between_jobs INTEGER NOT NULL DEFAULT 45 CHECK (buffer_minutes_between_jobs >= 0),
    working_hours_start TIME NOT NULL DEFAULT '07:30:00',
    working_hours_end TIME NOT NULL DEFAULT '17:30:00',
    work_weekends BOOLEAN NOT NULL DEFAULT false,
    emergency_keywords TEXT[] NOT NULL DEFAULT ARRAY[
        'flood', 'burst pipe', 'sewage', 'sparking', 
        'no heat', 'carbon monoxide', 'water main'
    ],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.assistant_settings IS 'Autonomous dispatch and conversational rules for RidgeLine AI.';

-- 3.3 Trade Services & Standard Price Book Catalog
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    trade trade_type NOT NULL,
    duration_hours NUMERIC(3, 1) NOT NULL DEFAULT 1.5 CHECK (duration_hours > 0),
    base_price NUMERIC(10, 2) NOT NULL DEFAULT 195.00 CHECK (base_price >= 0),
    description TEXT,
    is_popular BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.services IS 'Service menu used by the AI to quote prices and calculate slot lengths.';

-- 3.4 SMS Conversation Threads
CREATE TABLE IF NOT EXISTS public.sms_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    address TEXT,
    trade_type trade_type NOT NULL DEFAULT 'plumbing',
    unread_count INTEGER NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
    status thread_status NOT NULL DEFAULT 'active',
    booking_id UUID, -- forward reference resolved later
    is_manual_takeover BOOLEAN NOT NULL DEFAULT false,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.sms_threads IS 'Active bidirectional SMS threads between customers and RidgeLine / tradesperson.';

-- 3.5 Job Bookings & Dispatch Schedule
CREATE TABLE IF NOT EXISTS public.job_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    address TEXT NOT NULL,
    trade_type trade_type NOT NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    service_title VARCHAR(255) NOT NULL,
    scheduled_date DATE NOT NULL,
    time_slot VARCHAR(50) NOT NULL,
    status booking_status NOT NULL DEFAULT 'scheduled',
    estimate_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    urgency urgency_level NOT NULL DEFAULT 'routine',
    created_from booking_origin NOT NULL DEFAULT 'sms',
    sms_thread_id UUID REFERENCES public.sms_threads(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.job_bookings IS 'Confirmed service visits and dispatch appointments on the technician calendar.';

-- Add Foreign Key constraint for sms_threads -> job_bookings
ALTER TABLE public.sms_threads 
    ADD CONSTRAINT fk_sms_threads_booking 
    FOREIGN KEY (booking_id) 
    REFERENCES public.job_bookings(id) 
    ON DELETE SET NULL;

-- 3.6 Individual SMS Messages
CREATE TABLE IF NOT EXISTS public.sms_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.sms_threads(id) ON DELETE CASCADE,
    sender message_sender NOT NULL,
    text TEXT NOT NULL,
    status message_status NOT NULL DEFAULT 'delivered',
    action_tag action_tag,
    parsed_intent JSONB,
    twilio_message_sid VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.sms_messages IS 'Message history and AI action telemetry for customer SMS chats.';

-- 3.7 Missed Calls & Inbound Voicemails
CREATE TABLE IF NOT EXISTS public.missed_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    caller_name VARCHAR(150) NOT NULL DEFAULT 'Unknown Caller',
    caller_phone VARCHAR(30) NOT NULL,
    ring_duration_seconds INTEGER DEFAULT 0,
    voicemail_url TEXT,
    voicemail_transcript TEXT,
    auto_sms_sent BOOLEAN NOT NULL DEFAULT true,
    auto_sms_sent_at TIMESTAMPTZ DEFAULT NOW(),
    auto_sms_reply_received BOOLEAN NOT NULL DEFAULT false,
    converted_to_booking BOOLEAN NOT NULL DEFAULT false,
    booking_id UUID REFERENCES public.job_bookings(id) ON DELETE SET NULL,
    urgency urgency_level NOT NULL DEFAULT 'routine',
    twilio_call_sid VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.missed_calls IS 'Unanswered phone calls converted into booked jobs via automatic instant SMS.';

-- 3.8 Customers Catalog
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

COMMENT ON TABLE public.customers IS 'Directory of past and current service clients scoped by organization.';

-- 3.9 User Accounts & Contractor Authentication
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

COMMENT ON TABLE public.users IS 'Contractor user logins with organization association and role-based permissions.';

-- ==============================================================================
-- 4. Indexes for High Performance Querying
-- ==============================================================================

-- Organizations
CREATE INDEX IF NOT EXISTS idx_organizations_trade ON public.organizations (trade);

-- Services
CREATE INDEX IF NOT EXISTS idx_services_org ON public.services (organization_id);

-- Job Bookings
CREATE INDEX IF NOT EXISTS idx_bookings_org_date ON public.job_bookings (organization_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.job_bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON public.job_bookings (customer_phone);

-- SMS Threads
CREATE INDEX IF NOT EXISTS idx_threads_org_phone ON public.sms_threads (organization_id, customer_phone);
CREATE INDEX IF NOT EXISTS idx_threads_last_activity ON public.sms_threads (last_activity_at DESC);

-- SMS Messages
CREATE INDEX IF NOT EXISTS idx_messages_thread_created ON public.sms_messages (thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_action_tag ON public.sms_messages (action_tag);

-- Missed Calls
CREATE INDEX IF NOT EXISTS idx_missed_calls_org ON public.missed_calls (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_missed_calls_converted ON public.missed_calls (converted_to_booking);

-- Customers
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_org ON public.customers (organization_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_org ON public.customers (organization_id);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_org ON public.users (organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);

-- ==============================================================================
-- 5. Automatic Triggers & Stored Functions
-- ==============================================================================

-- 5.1 Updated_at auto-updater
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE OR REPLACE TRIGGER trg_assistant_settings_updated_at
    BEFORE UPDATE ON public.assistant_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE OR REPLACE TRIGGER trg_services_updated_at
    BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE OR REPLACE TRIGGER trg_sms_threads_updated_at
    BEFORE UPDATE ON public.sms_threads
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE OR REPLACE TRIGGER trg_job_bookings_updated_at
    BEFORE UPDATE ON public.job_bookings
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE OR REPLACE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE OR REPLACE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 5.2 Auto-update thread timestamp & unread count on new message
CREATE OR REPLACE FUNCTION public.handle_new_sms_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.sms_threads
    SET 
        last_activity_at = NEW.created_at,
        unread_count = CASE 
            WHEN NEW.sender = 'customer' THEN unread_count + 1 
            ELSE unread_count 
        END
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_on_sms_message_insert
    AFTER INSERT ON public.sms_messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_sms_message();

-- ==============================================================================
-- 6. Row-Level Security (RLS) Policies — Strict Multi-Tenant Isolation
-- ==============================================================================

-- Enable and FORCE Row Level Security on all tenant tables
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

-- 6.1 Tenant-scoped RLS policies
-- Organizations: Tenant can only view/modify their own organization
CREATE POLICY "Tenant isolation for organizations"
    ON public.organizations FOR ALL
    USING (id = app.current_organization_id())
    WITH CHECK (id = app.current_organization_id());

-- Assistant Settings: Tenant can only view/modify their own settings
CREATE POLICY "Tenant isolation for assistant_settings"
    ON public.assistant_settings FOR ALL
    USING (organization_id = app.current_organization_id())
    WITH CHECK (organization_id = app.current_organization_id());

-- Services: Tenant can only view/modify their catalog
CREATE POLICY "Tenant isolation for services"
    ON public.services FOR ALL
    USING (organization_id = app.current_organization_id())
    WITH CHECK (organization_id = app.current_organization_id());

-- Job Bookings: Tenant can only view/modify their schedule
CREATE POLICY "Tenant isolation for job_bookings"
    ON public.job_bookings FOR ALL
    USING (organization_id = app.current_organization_id())
    WITH CHECK (organization_id = app.current_organization_id());

-- SMS Threads: Tenant can only view/modify their customer threads
CREATE POLICY "Tenant isolation for sms_threads"
    ON public.sms_threads FOR ALL
    USING (organization_id = app.current_organization_id())
    WITH CHECK (organization_id = app.current_organization_id());

-- SMS Messages: Tenant can only view/insert messages for their threads
CREATE POLICY "Tenant isolation for sms_messages"
    ON public.sms_messages FOR ALL
    USING (thread_id IN (
        SELECT id FROM public.sms_threads 
        WHERE organization_id = app.current_organization_id()
    ))
    WITH CHECK (thread_id IN (
        SELECT id FROM public.sms_threads 
        WHERE organization_id = app.current_organization_id()
    ));

-- Missed Calls: Tenant can only view/modify their missed calls
CREATE POLICY "Tenant isolation for missed_calls"
    ON public.missed_calls FOR ALL
    USING (organization_id = app.current_organization_id())
    WITH CHECK (organization_id = app.current_organization_id());

-- Customers: Tenant can only view/modify their customers
CREATE POLICY "Tenant isolation for customers"
    ON public.customers FOR ALL
    USING (organization_id = app.current_organization_id())
    WITH CHECK (organization_id = app.current_organization_id());

-- Users: Users can view their own record or members of their organization
CREATE POLICY "Tenant isolation for users"
    ON public.users FOR ALL
    USING (organization_id = app.current_organization_id() OR id = app.current_user_id())
    WITH CHECK (organization_id = app.current_organization_id() OR id = app.current_user_id());

-- ==============================================================================
-- 7. Supabase Realtime Setup
-- ==============================================================================

-- Publish tables to Supabase Realtime publication so clients receive live updates
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_bookings;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_threads;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.missed_calls;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_object THEN null;
END $$;

-- ==============================================================================
-- 8. Production Seed Data
-- ==============================================================================

-- 8.1 Seed Primary Organization: Apex Plumbing & Mechanical
INSERT INTO public.organizations (
    id,
    name,
    trade,
    technician_name,
    license_number,
    service_radius_miles,
    business_address,
    email,
    plan,
    twilio_phone_number,
    forward_calls_to
) VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Apex Plumbing & Mechanical',
    'plumbing',
    'Mark Kowalski',
    'CA-PLUMB-982104',
    30,
    '104 Industrial Way, Suite B, Springfield',
    'dispatch@apexplumbingpro.com',
    'Solo Pro',
    '+1 (555) 782-4309',
    '+1 (555) 438-9210'
) ON CONFLICT (id) DO NOTHING;

-- 8.2 Seed Assistant Settings for Apex
INSERT INTO public.assistant_settings (
    organization_id,
    ai_tone,
    auto_confirm_routine,
    buffer_minutes_between_jobs,
    working_hours_start,
    working_hours_end,
    work_weekends,
    emergency_keywords
) VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'friendly_direct',
    true,
    45,
    '07:30:00',
    '17:30:00',
    false,
    ARRAY['flood', 'burst pipe', 'sewage', 'sparking', 'no heat', 'carbon monoxide', 'water main']
) ON CONFLICT (organization_id) DO NOTHING;

-- 8.3 Seed Service Catalog for Apex
INSERT INTO public.services (
    id,
    organization_id,
    title,
    trade,
    duration_hours,
    base_price,
    description,
    is_popular
) VALUES
(
    'b1111111-1111-1111-1111-111111111111',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Water Heater Replacement / Diagnostic',
    'plumbing',
    2.5,
    420.00,
    'Diagnose pilot assembly, heating elements, or full 50-gal tank replacement installation.',
    true
),
(
    'b2222222-2222-2222-2222-222222222222',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Main Line Drain Snaking / Hydrojet',
    'plumbing',
    1.5,
    285.00,
    'Camera inspection + heavy duty 100ft snake rooter for slow or backed-up main sewer cleanout.',
    true
),
(
    'b3333333-3333-3333-3333-333333333333',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Emergency Burst Pipe & Valve Shutoff',
    'plumbing',
    2.0,
    380.00,
    'Immediate dispatch for active interior leaks, broken copper/PEX fittings, and pressure relief failures.',
    true
),
(
    'b4444444-4444-4444-4444-444444444444',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Garbage Disposal & Kitchen Faucet Swap',
    'plumbing',
    1.0,
    195.00,
    'Replacement of jammed 1/2 HP Badger or leaky pull-down kitchen faucet assembly.',
    false
),
(
    'b5555555-5555-5555-5555-555555555555',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Whole-Home Pressure Regulator (PRV) Replacement',
    'plumbing',
    1.5,
    340.00,
    'Replace failed Wilkins/Watts PRV causing high municipal pressure spike & banging pipes.',
    false
) ON CONFLICT (id) DO NOTHING;

-- 8.4 Seed Initial SMS Threads
INSERT INTO public.sms_threads (
    id,
    organization_id,
    customer_name,
    customer_phone,
    address,
    trade_type,
    unread_count,
    status,
    last_activity_at
) VALUES 
(
    'c1111111-1111-1111-1111-111111111111',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Elena Rostova',
    '+1 (555) 234-8901',
    '742 Evergreen Terrace, Springfield',
    'plumbing',
    0,
    'booked',
    NOW() - INTERVAL '4 hours'
),
(
    'c2222222-2222-2222-2222-222222222222',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Marcus Vance',
    '+1 (555) 349-1122',
    '1840 Highland Ridge Dr, Westview',
    'plumbing',
    0,
    'booked',
    NOW() - INTERVAL '2 hours'
),
(
    'c3333333-3333-3333-3333-333333333333',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'David Thorne',
    '+1 (555) 912-3344',
    '88 Meadowbrook Way, Fairview',
    'plumbing',
    0,
    'rescheduled',
    NOW() - INTERVAL '1 hour'
) ON CONFLICT (id) DO NOTHING;

-- 8.5 Seed Initial Bookings
INSERT INTO public.job_bookings (
    id,
    organization_id,
    customer_name,
    customer_phone,
    address,
    trade_type,
    service_id,
    service_title,
    scheduled_date,
    time_slot,
    status,
    estimate_amount,
    notes,
    urgency,
    created_from,
    sms_thread_id
) VALUES 
(
    'd1111111-1111-1111-1111-111111111111',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Elena Rostova',
    '+1 (555) 234-8901',
    '742 Evergreen Terrace, Springfield',
    'plumbing',
    'b2222222-2222-2222-2222-222222222222',
    'Main Line Drain Snaking / Hydrojet',
    CURRENT_DATE,
    '08:30 AM - 10:30 AM',
    'completed',
    285.00,
    'Downstairs bathroom shower backing up with gray water. Cleanout located next to water meter.',
    'urgent',
    'sms',
    'c1111111-1111-1111-1111-111111111111'
),
(
    'd2222222-2222-2222-2222-222222222222',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Marcus Vance',
    '+1 (555) 349-1122',
    '1840 Highland Ridge Dr, Westview',
    'plumbing',
    'b1111111-1111-1111-1111-111111111111',
    'Water Heater Replacement / Diagnostic',
    CURRENT_DATE,
    '11:15 AM - 01:45 PM',
    'in_progress',
    650.00,
    'Rheem 50-gal electric water heater throwing fault code 3. Mark is on-site draining unit.',
    'routine',
    'missed_call',
    'c2222222-2222-2222-2222-222222222222'
),
(
    'd3333333-3333-3333-3333-333333333333',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'David Thorne',
    '+1 (555) 912-3344',
    '88 Meadowbrook Way, Fairview',
    'plumbing',
    'b3333333-3333-3333-3333-333333333333',
    'Emergency Burst Pipe & Valve Shutoff',
    CURRENT_DATE + INTERVAL '1 day',
    '09:00 AM - 11:00 AM',
    'scheduled',
    420.00,
    'Rescheduled from today via SMS! Copper pinhole leak under crawlspace; main shutoff secured.',
    'urgent',
    'sms',
    'c3333333-3333-3333-3333-333333333333'
) ON CONFLICT (id) DO NOTHING;

-- Link bookings back to threads
UPDATE public.sms_threads SET booking_id = 'd1111111-1111-1111-1111-111111111111' WHERE id = 'c1111111-1111-1111-1111-111111111111';
UPDATE public.sms_threads SET booking_id = 'd2222222-2222-2222-2222-222222222222' WHERE id = 'c2222222-2222-2222-2222-222222222222';
UPDATE public.sms_threads SET booking_id = 'd3333333-3333-3333-3333-333333333333' WHERE id = 'c3333333-3333-3333-3333-333333333333';

-- 8.6 Seed SMS Messages
INSERT INTO public.sms_messages (
    thread_id,
    sender,
    text,
    status,
    action_tag,
    created_at
) VALUES 
(
    'c1111111-1111-1111-1111-111111111111',
    'customer',
    'Hi Mark, our downstairs shower is backing up whenever someone runs the laundry. Can someone look at this today?',
    'read',
    null,
    NOW() - INTERVAL '5 hours'
),
(
    'c1111111-1111-1111-1111-111111111111',
    'assistant',
    'Good morning Elena! This is Mark''s automated scheduling assistant with Apex Plumbing. That sounds like a main sewer line backup. I have an opening this morning at 8:30 AM or afternoon at 2:30 PM. Would 8:30 AM work to get a technician out?',
    'delivered',
    'slot_offered',
    NOW() - INTERVAL '4 hours 59 minutes'
),
(
    'c1111111-1111-1111-1111-111111111111',
    'customer',
    '8:30 AM is perfect please! We are at 742 Evergreen Terrace.',
    'read',
    null,
    NOW() - INTERVAL '4 hours 58 minutes'
),
(
    'c1111111-1111-1111-1111-111111111111',
    'assistant',
    'You''re booked for today, 8:30 AM - 10:30 AM at 742 Evergreen Terrace. Mark will text you when he''s 15 mins out with the service truck. Estimated inspection & snaking is $285.',
    'delivered',
    'auto_booked',
    NOW() - INTERVAL '4 hours 57 minutes'
);

-- 8.7 Seed Missed Calls
INSERT INTO public.missed_calls (
    id,
    organization_id,
    caller_name,
    caller_phone,
    ring_duration_seconds,
    voicemail_transcript,
    auto_sms_sent,
    auto_sms_reply_received,
    converted_to_booking,
    booking_id,
    urgency,
    created_at
) VALUES 
(
    'e1111111-1111-1111-1111-111111111111',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Marcus Vance',
    '+1 (555) 349-1122',
    18,
    'Hey Mark, Marcus Vance here. My water heater in the utility closet is pooling water all over the floor. Give me a call back or let me know if you can come today.',
    true,
    true,
    true,
    'd2222222-2222-2222-2222-222222222222',
    'emergency',
    NOW() - INTERVAL '3 hours'
),
(
    'e2222222-2222-2222-2222-222222222222',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Linda Chen',
    '+1 (555) 441-2098',
    24,
    'Hi, I need someone to look at my pressure reducing valve, the water pressure is rattling the pipes through the whole house. 1104 Sycamore Creek.',
    true,
    true,
    false,
    null,
    'routine',
    NOW() - INTERVAL '5 hours'
),
(
    'e3333333-3333-3333-3333-333333333333',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Robert Gallagher',
    '+1 (555) 603-7721',
    12,
    'Looking for a rough-in estimate for adding a half bath in the basement.',
    true,
    false,
    false,
    null,
    'routine',
    NOW() - INTERVAL '6 hours'
) ON CONFLICT (id) DO NOTHING;

-- 8.8 Seed Primary Demo User
INSERT INTO public.users (
    id,
    email,
    password_hash,
    full_name,
    role,
    organization_id,
    onboarding_completed
) VALUES (
    'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'mark@apexplumbingpro.com',
    '73934371fa7ba4ad2fb2df3db275e533:f9ea343a4e9b94098492025256e2974fa214309a47d2f9b8c0953a7f80879a95764d95b54203ad6f73111fdb8542fc3a4df44c1ee0085ef19de172e276f7c9e0',
    'Mark Kowalski',
    'owner',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    true
) ON CONFLICT (email) DO NOTHING;

-- 8.9 Seed Customers
INSERT INTO public.customers (
    id,
    organization_id,
    name,
    phone,
    email,
    address,
    notes
) VALUES
(
    'a1111111-aaaa-1111-aaaa-111111111111',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Elena Rostova',
    '+1 (555) 234-8901',
    'elena.rostova@example.com',
    '742 Evergreen Terrace, Springfield',
    'Prefers morning calls. Gate code #4412.'
),
(
    'a2222222-aaaa-2222-aaaa-222222222222',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Marcus Vance',
    '+1 (555) 349-1122',
    'mvance99@example.com',
    '1840 Highland Ridge Dr, Westview',
    'Has Rheem 50-gal water heater installed in utility closet.'
),
(
    'a3333333-aaaa-3333-aaaa-333333333333',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'David Thorne',
    '+1 (555) 912-3344',
    'dthorne@fairviewtech.io',
    '88 Meadowbrook Way, Fairview',
    'Crawlspace access via hatch behind garage.'
) ON CONFLICT (organization_id, phone) DO NOTHING;

-- ==============================================================================
-- End of Migration 20260927000000_init_ridgeline_schema.sql
-- ==============================================================================
