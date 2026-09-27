# Product Requirements Document (PRD)

## Project Name: RidgeLine — AI Scheduling & Dispatch Assistant for Solo Tradespeople
**Document Version:** 2.4.0  
**Target Date:** Q3/Q4 2026  
**Status:** Approved & Implemented  
**Target Audience:** Solo Plumbing, Electrical, Locksmith, and HVAC Contractors  

---

## 1. Executive Summary & Vision

### 1.1 Executive Summary
RidgeLine is an autonomous, AI-driven dispatch and scheduling assistant engineered specifically for **solo trade business owners** (one-truck contractors). Unlike generic CRM software or complex enterprise dispatch suites (e.g., ServiceTitan, Housecall Pro), RidgeLine focuses exclusively on the critical 3-minute window when a homeowner calls or texts while the tradesperson is actively on tools.

By intercepting missed calls with instantaneous AI textbacks and holding natural-language SMS booking dialogues, RidgeLine turns lost phone leads into high-margin scheduled appointments without requiring the tradesperson to drop their tools or wash their hands.

### 1.2 Target Personas
- **Solo Master Plumber**: Spends 75% of work hours in basements, crawlspaces, or under cabinets. Misses 4–8 phone calls daily from prospects looking for drain cleanings or leak repairs.
- **Independent Licensed Electrician**: On ladders pulling wire in attics or panels. Needs strict buffer times between jobs and cannot afford double-bookings.
- **Emergency HVAC Tech**: Deals with extreme winter furnace failures and summer condenser blowouts. Needs automated emergency triage and priority slot allocation.

---

## 2. Problem Statement & Opportunities

| Problem | Root Cause | RidgeLine Solution |
| :--- | :--- | :--- |
| **Voicemail Abandonment** | 80%+ of consumers hanging up on a solo tradesperson's voicemail immediately call a competitor. | Autonomous SMS textback initiated within **3 seconds** of a missed call. |
| **Tool-to-Phone Interruption** | Responding to texts while soldering or pulling wire leads to distraction, safety hazards, and physical phone damage. | Dedicated AI assistant engages customer, gathers symptoms, collects address, and offers available time slots. |
| **Scheduling Overhead & Double-Booking** | Solo contractors manually negotiate slots over multiple text exchanges across hours. | Automated schedule lookahead checks real calendar availability and auto-confirms appointments into the dispatch board. |
| **Emergency Escalation Failure** | Critical plumbing/electrical hazards get buried in standard SMS queues. | Intelligent intent classifier tags "Emergency" and sends immediate safety instructions while alerting the owner. |

---

## 3. Goals & Key Performance Indicators (KPIs)

### 3.1 Business & User Goals
1. **Zero Missed Revenue**: Convert ≥ 40% of missed calls into confirmed appointments within 15 minutes.
2. **Reduced Phone Screen Time**: Reduce owner phone handling during active work hours by ≥ 70%.
3. **Zero Double-Bookings**: 100% schedule consistency across all confirmed jobs.
4. **Instant Response Latency**: Deliver SMS responses in under 2.5 seconds.

### 3.2 Product Metrics
- **Missed Call Conversion Rate**: `% of missed calls converted to bookings` (Target: > 35%).
- **Time to First Response (TTFR)**: Average seconds from incoming SMS/call to outbound AI reply (Target: < 3s).
- **Auto-Confirmation Rate**: `% of routine jobs booked without manual tradesperson intervention` (Target: > 60%).
- **Chart & Board Time to Interactive (TTI)**: Data view load and skeleton transition duration (Target: < 400ms).

---

## 4. User Journey & Feature Specifications

### 4.1 Missed Call to Auto-Confirmation Journey
1. **Trigger**: Homeowner calls the tradesperson's Twilio phone number; call goes unanswered as technician is on-site.
2. **Textback**: RidgeLine triggers an SMS: *"Hi! This is RidgeLine, dispatcher for Mark at Kowalski Plumbing. Mark is under a sink on a job right now and can't pick up. What plumbing issue can we help you solve?"*
3. **Dialogue**:
   - Customer: *"My water heater is leaking all over my basement floor."*
   - AI: *"I understand how urgent that is! First, please locate the cold water shutoff valve on top of the tank and turn it clockwise to stop incoming water. We can have Mark at your home today between 1:00 PM and 3:00 PM. What is your street address?"*
   - Customer: *"1420 Oak Ridge Lane. 1:00 PM works."*
4. **Auto-Booking**: AI verifies the slot is free, logs the job as **Water Heater Leak Repair** ($380 est.), sets status to **Scheduled**, records customer profile, and texts confirmation with arrival window.
5. **Dispatch Board Update**: Job appears live on the Dispatch Board with address, customer telephone, emergency tag, and navigation shortcut.

---

## 5. Functional Requirements

### 5.1 Authentication, Multi-Tenancy & Workspace
- **Multi-Tenant Architecture**: Isolate tenant records by `organization_id`.
- **User Roles**: Support `owner`, `dispatcher`, and `technician`.
- **Workspace Switcher**: Allow rapid switching between distinct trade organizations (e.g., Plumbing vs. Electrical division).
- **Onboarding Wizard**: 4-step interactive setup collecting trade type, pricing, Twilio forwarding number, and AI persona.

### 5.2 SMS & Voice Communication Engine
- **Twilio Webhook Ingestion**: Ingest SMS messages and Voice Call status callbacks.
- **Conversational Memory**: Maintain per-thread conversation history with chronological ordering.
- **Intent Triage Classification**:
  - `Emergency`: Active water/gas leaks, sparking electrical.
  - `Urgent`: No hot water, clogged primary toilet.
  - `Routine`: Fixture installs, panel upgrades, maintenance quotes.
- **AI Gateway & LLM Engine Flexibility**:
  - Native OpenAI-compatible `/chat/completions` endpoint support (e.g. 9router, LiteLLM, vLLM, Ollama).
  - Configurable Base URL, Bearer API Key, and Model (default: `gemini/gemini-3.8-flash`).
  - Automatic fallback between OpenAI-compatible gateway, direct Gemini SDK, and deterministic rule-based engines.
- **Auto-Confirm Rules**: Configurable toggle allowing auto-confirmation of routine jobs without manual owner review.

### 5.3 Dispatch Management Board
- **Status Lifecycle**: `scheduled` ➔ `en_route` ➔ `in_progress` ➔ `completed` (or `cancelled`).
- **One-Click Actions**: Dial customer, open SMS thread, view GPS address, and update status.
- **Filter & Search**: Quick filters by day (Today, Tomorrow, All) and urgency level.

### 5.4 Service Catalog & Quoting
- Structured trade catalog with estimated durations (hours), base pricing, diagnostic fee, and required materials.
- Autonomous quotation generation matching user symptoms to catalog line items.

### 5.5 Analytics & Charting Skeletons
- **Overview Dashboard**: Completed bookings vs. booked revenue over rolling 7-day period.
- **Tab-Specific Recharts Visualizations**:
  - Dispatch: 7-Day Workload Velocity & Execution Capacity (AreaChart).
  - Missed Calls: 7-Day Call Recovery Velocity (BarChart).
  - Customers: 7-Day Customer Revenue & Repeat Booking Velocity (AreaChart).
- **Skeleton States**: Full loading skeleton integration across all tabs when data is refreshed from the API.

---

## 6. Non-Functional Requirements

### 6.1 Performance & Reliability
- **Frontend Bundle Size**: Minified and optimized with Vite and Tailwind v4.
- **Response Latency**: Express API endpoints respond in < 150ms; Gemini AI generation completes in < 1.8s.
- **Offline & Memory Fallbacks**: Frontend provides graceful fallback to cached memory state if network or database is temporarily unreachable.

### 6.2 Security & Data Privacy
- **Password Hashing**: PBKDF2 with unique cryptographic salt per user.
- **Row-Level Security (RLS)**: PostgreSQL policies ensuring users can only read and mutate records belonging to their active organization.
- **Zero API Keys in Client**: All Gemini AI, Twilio, and database credentials remain strictly server-side.

### 6.3 Compliance & Mobile Usability
- Designed for mobile and tablet touch viewports (safe tap targets ≥ 44px).
- High-contrast visual indicators for dirty-screen or high-glare field environments.

---

## 7. Database Entity Relationship Model (PostgreSQL)

```
[organizations]
 ├── id (UUID, PK)
 ├── name (TEXT)
 ├── trade (trade_type ENUM)
 ├── technician_name (TEXT)
 └── twilio_phone_number (TEXT)
        │ 1:N
        ├────────────────────────────┐
        ▼                            ▼
   [users]                     [customers]
    ├── id (UUID, PK)           ├── id (UUID, PK)
    ├── email (TEXT, UNIQUE)    ├── full_name (TEXT)
    ├── role (TEXT)             ├── phone (TEXT)
    └── organization_id (FK)    └── address (TEXT)
                                     │ 1:N
                                     ├────────────────────────────┐
                                     ▼                            ▼
                                [bookings]                   [sms_threads]
                                 ├── id (UUID, PK)            ├── id (UUID, PK)
                                 ├── title (TEXT)             ├── customer_phone (TEXT)
                                 ├── status (ENUM)            ├── urgency (ENUM)
                                 ├── scheduled_time (TIMESTAMP)└── status (ENUM)
                                 └── price (NUMERIC)               │ 1:N
                                                                   ▼
                                                             [sms_messages]
                                                              ├── id (UUID, PK)
                                                              ├── sender (ENUM)
                                                              ├── body (TEXT)
                                                              └── action_tag (ENUM)
```

---

## 8. Release Roadmap

- **Phase 1 (Completed)**: Core Dispatch Kanban, Gemini 2.5 SMS engine, Missed Call simulator, and multi-tenant Neon database schema.
- **Phase 2 (Completed)**: Recharts 7-day velocity charts with skeleton loading states across all dashboard tabs, interactive live data sync, and multi-org switching.
- **Phase 3 (Upcoming)**: Native Twilio SMS inbound number auto-provisioning, QuickBooks Online invoice sync, and offline PWA service worker mode.
