# RidgeLine - AI Scheduling & Dispatch Assistant

> **AI-powered scheduling, dispatch engine, and missed-call recovery system designed specifically for solo tradespeople.**  
> Built with React 19, TypeScript, Tailwind CSS v4, Express, Gemini 2.5/Flash AI, Neon Lakebase Serverless Postgres, and Recharts.

---

## 🛠️ The Solo Tradesperson Problem

Solo plumbers, electricians, locksmiths, and HVAC technicians face a persistent operational bottleneck: **they cannot answer phone calls or reply to text messages when they are under a sink, in an attic, on a roof, or in a crawlspace.**

- **Lost Revenue**: Over 62% of calls to solo trade contractors go to voicemail when on-job. Homeowners with leaking pipes or tripped breakers simply dial the next contractor on Google.
- **Context Switching**: Taking dirty gloves off to read texts or negotiate calendar slots causes delays, safety risks, and lost focus.
- **Scheduling Friction**: Coordinating schedules via natural-language text messages ("Can you push to Thursday afternoon?") is tedious and error-prone.

**RidgeLine solves this with an autonomous 24/7 AI dispatch assistant** that:
1. Answers customer SMS queries warmly, concisely, and decisively.
2. Identifies customer intent, urgency, and matches job descriptions to the trade service catalog.
3. Automatically offers viable calendar slots and auto-confirms bookings without double-booking.
4. Triages emergencies (gas leaks, pipe bursts, active electrical sparks) with immediate safety instructions and instant escalation.
5. Captures missed phone calls and sends instant AI textback to convert cold leads into booked revenue before they hire a competitor.
6. Displays interactive real-time telemetry, 7-day velocity analytics, and dispatch schedules with zero-latency Recharts and responsive skeleton loading states.

---

## 🚀 Key Features

### 1. SMS Conversation Engine & Auto-Booking
- **Natural-Language Understanding**: Interprets colloquial homeowner requests ("My kitchen faucet won't stop sputtering", "Push my water heater install to Friday at 2").
- **Smart Catalog Matching**: Dynamically computes job estimates, standard duration, and required parts from the trade's service catalog.
- **Double-Booking Prevention**: Inspects current calendar and buffer times before offering appointment windows.
- **Autonomous Auto-Confirmation**: Once the customer approves a time, the system commits the appointment to the database and schedules automated SMS reminders.

### 2. Instant Missed-Call Recovery
- Intercepts missed incoming calls from Twilio voice webhooks or simulated calls.
- Dispatches an automated, personalized text back within **3 seconds**:  
  *"Hey! This is RidgeLine, dispatcher for Mark at Kowalski Plumbing. Mark is currently on a job and can't pick up. What plumbing issue are you experiencing today?"*
- Converts 40%+ of abandoned calls directly into scheduled, paid appointments.

### 3. Emergency Triage & Safety Escalation
- Autonomous keyword and semantic detection for life-safety or catastrophic property damage risks (e.g., active flooding, carbon monoxide, sparking panels, gas odors).
- Immediately replies with safety precautions (e.g., *"Please turn off the main water shutoff valve clockwise immediately"*).
- Triggers priority alert banners and bypasses routine buffer scheduling.

### 4. Interactive Dispatch Board
- Kanban-style dispatch board tracking jobs through stages: **Scheduled**, **En Route**, **In Progress**, and **Completed**.
- Real-time customer phone dialing, SMS thread shortcuts, turn-by-turn navigation addresses, and urgent status badges.

### 5. Multi-Tenant Architecture & Workspace Switcher
- Supports multiple trade companies (e.g., *Kowalski Plumbing & Drain*, *Apex Spark Electric*, *Vanguard HVAC Systems*).
- Switch seamlessly between trades with tenant-isolated database records, custom trade services, and distinct Twilio numbers.

### 6. Analytics & Recharts Dashboards with Skeleton States
- **Rolling 7-Day Performance Charts**:
  - **Overview**: Completed Bookings vs. Gross Booked Revenue.
  - **Dispatch**: 7-Day Workload Velocity & Execution Capacity (AreaChart).
  - **Missed Calls**: 7-Day Call Recovery Velocity & Conversion Rates (BarChart).
  - **Customers**: 7-Day Customer Revenue & Repeat Booking Velocity (AreaChart).
- **Responsive Skeleton Loading States**: Smooth animated SVG wave curves, gridlines, dual-column skeletons, and pill badges while data syncs from Neon Postgres or API routes.

---

## 🏛️ System Architecture

```
                          ┌──────────────────────────┐
                          │   Twilio SMS / Voice     │
                          │   (Webhooks & Messages)  │
                          └────────────┬─────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Express Server (:3000)                        │
│                                                                        │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ Gemini 2.5 Flash SDK  │  │ Neon Lakebase   │  │ Auth & Security  │  │
│  │ AI Dispatch Engine    │  │ Serverless Pool │  │ PBKDF2 / Multi-  │  │
│  │ (Triage & Slot Match) │  │ (Postgres 15+)  │  │ Tenant Isolator  │  │
│  └───────────────────────┘  └─────────────────┘  └──────────────────┘  │
└──────────────────────────────────────┬─────────────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        React 19 Frontend (Vite)                        │
│                                                                        │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ Dispatch Kanban Board │  │ SMS Inbox View  │  │ Missed Call Desk │  │
│  └───────────────────────┘  └─────────────────┘  └──────────────────┘  │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ Recharts Visualizer   │  │ Customer CRM    │  │ Org & Settings   │  │
│  │ (with Skeleton State) │  │ & Service Specs │  │ & Live Simulator │  │
│  └───────────────────────┘  └─────────────────┘  └──────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
├── .agents/skills/            # Agent tool skills (Neon, AI gateway, auth)
├── index.html                 # App HTML shell with Bricolage & IBM Plex typography
├── metadata.json              # Studio project metadata and capabilities
├── package.json               # Dependencies & build scripts
├── server.ts                  # Express backend with Gemini AI & Neon Postgres integration
├── src/
│   ├── App.tsx                # Main application orchestrator & routing
│   ├── components/
│   │   ├── ChartSkeleton.tsx         # Reusable Recharts skeleton loading states
│   │   ├── CompletedBookingsChart.tsx# 7-day bookings overview Recharts component
│   │   ├── MetricCards.tsx           # Quick metric indicators with sparkline bars
│   │   ├── DispatchBoard.tsx         # Dispatch kanban & 7-day workload velocity chart
│   │   ├── SmsInbox.tsx              # Interactive 2-way SMS conversation thread viewer
│   │   ├── MissedCallsView.tsx       # Missed call recovery table & 7-day bar chart
│   │   ├── CustomersView.tsx         # Client profiles, history & revenue area chart
│   │   ├── ServiceCatalog.tsx        # Trade service pricing, durations & parts
│   │   ├── Header.tsx                # App bar with live sync button & status
│   │   ├── AppSidebar.tsx            # Navigation sidebar with unread counters
│   │   ├── OrgSwitcher.tsx           # Multi-organization switcher
│   │   ├── OrganizationSettings.tsx  # Trade configuration & AI tone settings
│   │   ├── SimulateSmsModal.tsx      # Interactive customer SMS tester
│   │   ├── SimulateCallModal.tsx     # Voice call simulation & textback trigger
│   │   └── NewBookingModal.tsx       # Manual dispatch appointment creator
│   ├── pages/
│   │   ├── AuthPage.tsx              # Secure Login & Registration
│   │   └── OnboardingPage.tsx        # 4-step wizard for solo contractor setup
│   ├── mockData.ts                   # In-memory baseline data & fallback state
│   ├── types.ts                      # TypeScript models (Bookings, Threads, Orgs, Users)
│   └── index.css                     # Tailwind CSS v4 styling & typography
└── supabase/migrations/
    └── 20260927000000_init_ridgeline_schema.sql # Complete Postgres schema with RLS
```

---

## ⚡ Quick Start & Development

### 1. Prerequisites
- Node.js 20+
- A Google Gemini API Key (`GEMINI_API_KEY`)
- *(Optional)* A Neon PostgreSQL database URL (`DATABASE_URL`)

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure the following variables are defined:
```ini
# OpenAI-Compatible AI Gateway Settings (e.g. 9router, vLLM, LiteLLM, Ollama)
OPENAI_COMPATIBLE_BASE_URL="https://9router-production-a99a.up.railway.app/v1"
OPENAI_COMPATIBLE_API_KEY="sk-0d71fb7c21ea2f91-mv2hhc-443a0a26"
OPENAI_COMPATIBLE_MODEL="gemini/gemini-3.8-flash"

# Google Gemini API Key (Direct SDK fallback)
GEMINI_API_KEY="your_gemini_api_key"

# Database (Neon Lakebase Postgres)
DATABASE_URL="postgresql://user:pass@ep-example-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

### 3. Installation & Run
```bash
# Install dependencies
npm install

# Run the development server (Express backend + Vite frontend)
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
npm run start
```

---

## 🧪 Simulation & Testing Features

RidgeLine includes built-in simulation tools so solo tradespeople and reviewers can test live AI behavior without burning carrier SMS credits:

1. **Simulate Customer SMS**: Click **"Simulate SMS"** to send incoming messages (e.g., *"My basement pipe burst, water is spraying everywhere!"* or *"Can we reschedule our drain cleaning to tomorrow at 10am?"*). Watch the Gemini assistant reply and auto-dispatch within seconds.
2. **Simulate Missed Call**: Click **"Simulate Call"** to emulate a caller leaving voicemail. RidgeLine triggers an autonomous auto-textback into the SMS inbox.
3. **Live Sync & Skeletons**: Click **"Sync Data"** in the top header at any time to verify live Neon database roundtrips and preview the Recharts skeleton transitions.

---

## 🛡️ License

Built for solo trade professionals. Distributed under the MIT License.
