# SKY Clinic

A clinic web application with separate **Doctor** and **Patient** portals: patient records, prescriptions, real-time messaging, and doctor-initiated audio/video consultations via **Cloudflare RealtimeKit**.

| | |
|---|---|
| **Live app** | https://web-phi-lovat-52.vercel.app |
| **API** | https://clinic-api-sepia.vercel.app/health |
| **Stack** | Next.js 15 · React 19 · NestJS 11 · TypeScript · Prisma · PostgreSQL · Pusher Channels · Cloudflare RealtimeKit |

> **Legal notice.** © 2026 SKY TECH CONSULTING LTD. All rights reserved. This is a **demo project**: it may not be used, copied, modified, deployed or distributed without prior written consent from SKY TECH CONSULTING LTD. All data is fictional; the app is **not for medical use** and must not hold real patient information. See [LICENSE](LICENSE).

## Test credentials

All accounts use the password **`Password123!`** (fictional data only).

| Role | Email | Notes |
|---|---|---|
| Doctor 1 – General Physician | `doctor1@clinic.test` | Patients 1–20 |
| Doctor 2 – General Surgeon | `doctor2@clinic.test` | Patients 21–40 |
| Patient | `patient1@clinic.test` … `patient20@clinic.test` | Assigned to Doctor 1 |
| Patient | `patient21@clinic.test` … `patient40@clinic.test` | Assigned to Doctor 2 |

> Sessions are stored per browser tab (`sessionStorage`), so you can be logged in as a doctor in one tab and as a patient in another tab of the same browser. A second browser works too.

## Features

**Doctor portal**
- Patient list showing only the doctor's assigned patients, with search by name, MRN, or email
- Patient profile: demographics, allergies, conditions, lab results (grouped by draw, with abnormal flags), imaging reports, and medication history
- Add a prescription (validated on the server)
- Real-time messaging with the patient
- Start an **audio** or **video** call; ringing state, cancel, a 45 s no-answer timeout, and "declined" notification

**Patient portal**
- Real-time messaging with their doctor
- Incoming call dialog with ringtone: **Accept** or **Decline**, and **End** during the call
- No way to start a call: there's no UI for it, and the API rejects it with `403`

## Architecture

```
┌────────────────────┐   HTTPS (JWT)   ┌─────────────────────────┐      ┌──────────────┐
│  Next.js (Vercel)  │ ──────────────▶ │  NestJS API (Vercel fn) │ ───▶ │  PostgreSQL  │
│  apps/web          │                 │  apps/api               │      │  (Neon)      │
└─────────┬──────────┘                 └───────┬─────────┬───────┘      └──────────────┘
          │ WebSocket (private channel)        │ trigger │ REST (server-side API token)
          ▼                                    ▼         ▼
   ┌─────────────────┐ ◀───────────────────────┘   ┌─────────────────────────┐
   │ Pusher Channels │                             │ Cloudflare RealtimeKit  │
   └─────────────────┘                             └────────────┬────────────┘
          ▲                                                     │ WebRTC media
          └──── browser joins call with a per-participant token ┘
```

```
apps/
  api/                  NestJS backend
    prisma/             schema, migrations, seed
    src/auth/           JWT login, global auth + roles guards, patient access control
    src/patients/       patient list/profile, prescriptions
    src/messages/       conversation per patient
    src/calls/          call lifecycle + RealtimeKit REST client
    src/realtime/       Pusher publisher + private-channel authorization
    src/serverless.ts   Vercel function entry (cached Nest instance)
    test/               unit tests (access control, call rules)
  web/                  Next.js frontend
    src/providers/      auth, realtime (Pusher), call state machine
    src/components/     chat, prescription form, call room (RealtimeKit UI Kit)
    src/app/            /login, /doctor, /doctor/patients/[id], /patient
.github/workflows/      ci.yml (PRs/branches), deploy.yml (main → migrate → deploy)
```

### Key technical decisions

- **Monorepo with npm workspaces.** One repo, one PR covers API and UI changes together, and CI runs everything.
- **NestJS on Vercel as a serverless function.** The assignment targets Vercel, and running both apps there means one platform, one deploy pipeline, and free-tier hosting. The Nest app is bootstrapped once per function instance and reused (`src/serverless.ts`).
- **Pusher Channels for real-time.** Serverless functions can't hold long-lived WebSocket connections, so the API publishes events to Pusher after writing to the database. Each user subscribes to `private-user-<id>`, and the API authorizes subscriptions (`POST /realtime/auth`) so a user can only join their own channel. The database stays the source of truth: clients refetch on reconnect, so a missed event doesn't lose data.
- **Calls are server-controlled.** The browser never sees the Cloudflare API token. `POST /calls` (doctor only) creates a RealtimeKit meeting, adds the doctor as host, stores a `Call` row (`RINGING`), and notifies the patient. `POST /calls/:id/accept` (patient only) adds the patient and returns their token. Each token is scoped to one meeting and expires after 2 hours. State changes use conditional updates (`RINGING → ACTIVE/DECLINED/MISSED`, `ACTIVE → ENDED`), so racing actions such as accept and cancel at the same moment can't both succeed.
- **Audio vs video through RealtimeKit presets.** Video calls use the default `group_call_*` presets. Audio calls use presets whose meeting type is **Voice**, so cameras are disabled by the platform itself and the call is billed as audio-only.
- **Access control in one place.** A global `JwtAuthGuard` (opt-out via `@Public()`) and `RolesGuard` (`@Roles('DOCTOR')`) protect routes. `PatientAccessService` enforces record-level access: a doctor sees only their assigned patients, and a patient sees only their own record. Unauthorized record access returns **404**, so the API doesn't reveal which patient IDs exist.
- **Prisma + PostgreSQL.** The data is relational (doctor → patients → labs/imaging/prescriptions/messages/calls), and Prisma provides typed queries and versioned migrations. Each patient has exactly one doctor, so a conversation is keyed by `patientId`, with no extra join table.

### Data model

`User` (role DOCTOR | PATIENT) → `Doctor` | `Patient`. `Patient` belongs to one `Doctor` and has many `LabResult`, `ImagingReport`, `Prescription`, `Message`, and `Call` rows. See [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma).

### API

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/login` | public | Email/password → JWT |
| GET | `/auth/me` | any | Current user profile |
| GET | `/patients?search=` | doctor | Assigned patients |
| GET | `/patients/:id` | doctor (assigned) | Full record |
| POST | `/patients/:id/prescriptions` | doctor (assigned) | Add prescription |
| GET/POST | `/conversations/:patientId/messages` | doctor (assigned) or that patient | Read / send messages |
| POST | `/calls` | **doctor only** | Start audio/video call |
| GET | `/calls/current` | any | Ringing/active call for this user |
| GET | `/calls/patient/:patientId` | participants | Call history |
| POST | `/calls/:id/accept` · `/decline` | patient (callee) | Answer / decline |
| POST | `/calls/:id/end` | either participant | End or cancel |
| POST | `/realtime/auth` | any | Pusher private-channel auth (own channel only) |
| GET | `/health` | public | Health + DB check |

## Local setup

Prerequisites: Node 20+ (22 recommended), Docker, a free [Pusher Channels](https://pusher.com/channels) app, and a Cloudflare account with [RealtimeKit](https://dash.cloudflare.com/?to=/:account/realtime/kit).

```bash
npm install
cp apps/api/.env.example apps/api/.env          # fill in values (see below)
cp apps/web/.env.example apps/web/.env.local    # fill in values
npm run db:up                                   # Postgres in Docker
npm run db:migrate                              # apply migrations
npm run db:seed                                 # demo data
npm run dev                                     # API :4000 + web :3000
```

Open http://localhost:3000.

### Environment variables

**API (`apps/api/.env`)**

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (pooled in production) |
| `DIRECT_DATABASE_URL` | Direct (non-pooled) connection used for migrations |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Token signing secret and lifetime (default `8h`) |
| `WEB_ORIGIN` | Allowed CORS origin(s), comma-separated |
| `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER` | Pusher Channels app |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `RTK_APP_ID` | RealtimeKit (API token needs **Realtime Admin** permission) |
| `RTK_PRESET_VIDEO_HOST`, `RTK_PRESET_VIDEO_PARTICIPANT` | Default: `group_call_host` / `group_call_participant` |
| `RTK_PRESET_AUDIO_HOST`, `RTK_PRESET_AUDIO_PARTICIPANT` | Default: `voice_call_host` / `voice_call_participant` |

**Web (`apps/web/.env.local`)**: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`.

### Cloudflare RealtimeKit setup

1. In the Cloudflare dashboard → **Realtime → RealtimeKit**, create an app and copy its **App ID**. Apps created in the dashboard include default presets such as `group_call_host` and `group_call_participant`.
2. Create two more presets with **meeting type = Voice**: `voice_call_host` and `voice_call_participant`. Allow audio for both.
3. Create an API token with **Realtime Admin** permission, and copy your **Account ID**.

### Pusher setup

Create a Channels app and leave **client events** disabled (the server is the only publisher). Copy the app ID, key, secret, and cluster.

## Deployment (Vercel + Neon + GitHub Actions)

Both apps deploy to Vercel as two projects from this repo. Deployments are driven by GitHub Actions, so the whole pipeline is visible in the Actions tab.

1. **Database:** create a free [Neon](https://neon.tech) Postgres project. Use its pooled URL as `DATABASE_URL` and its direct URL as `DIRECT_DATABASE_URL`.
2. **Vercel projects:** import the repo twice:
   - `clinic-api`: Root Directory `apps/api`, Framework *Other*. Add all API env vars, and set `WEB_ORIGIN` to the web URL.
   - `clinic-web`: Root Directory `apps/web`, Framework *Next.js*. Set `NEXT_PUBLIC_API_URL` to the API URL, plus the Pusher key and cluster.

   Each app's `vercel.json` sets `git.deploymentEnabled: false`, so Vercel doesn't also deploy on push; GitHub Actions is the single deploy path.
3. **GitHub secrets** (Settings → Secrets and variables → Actions, environment `production`):
   `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_API_PROJECT_ID`, `VERCEL_WEB_PROJECT_ID`, `DATABASE_URL`, `DIRECT_DATABASE_URL`.
   Project and org IDs are in each Vercel project's settings, or in `.vercel/project.json` after `vercel link`.
4. **Seed production once:** `DATABASE_URL=... DIRECT_DATABASE_URL=... npm run db:seed`.

### Pipeline

- **`ci.yml`** runs on every pull request and feature-branch push: install → lint → typecheck → unit tests → migrate + seed a throwaway Postgres → build both apps → API smoke test. The smoke test asserts that a patient gets `403` from `POST /calls`.
- **`deploy.yml`** runs on push to `main` (i.e. a merged PR): runs CI → `prisma migrate deploy` on production → deploys the API → deploys the web app.

Branch workflow: `feature/*` branch → PR (CI runs) → merge to `main` (deploys automatically). Protect `main` in branch settings and require the CI check.

## Demo script

1. Log in as `doctor1@clinic.test` → patient list (20 patients); try the search box.
2. Open a patient → review the Overview, Lab results, Imaging, and Medications tabs.
3. **Medications** → add a prescription → it appears at the top of the history.
4. Send a message from the chat panel.
5. In another browser (or tab), log in as that patient (e.g. `patient1@clinic.test`) → the message arrives live → reply. The doctor sees it instantly.
6. As the doctor, click **Audio call** → the patient sees the incoming call → **Accept** → talk → **End call** (either side).
7. Repeat with **Video call**. Also try **Decline**, and cancelling before the patient answers.
8. The patient portal has no call buttons. Calling the API directly also fails:
   ```bash
   curl -X POST $API/calls -H "Authorization: Bearer <patient token>" \
        -H 'Content-Type: application/json' -d '{"patientId":"...","type":"AUDIO"}'
   # → 403 Forbidden
   ```
9. Push a change on a branch → open a PR (CI runs) → merge → watch **Deploy** in the Actions tab.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run API and web in watch mode |
| `npm run lint` / `typecheck` / `test` / `build` | Run across all workspaces |
| `npm run db:up` / `db:migrate` / `db:seed` | Local database helpers |

## Limitations and next steps

- Auth uses a bearer JWT held in `sessionStorage`. In production I'd move to httpOnly cookies with refresh tokens, behind a shared domain.
- If a participant refreshes the page mid-call, they can't rejoin. Adding a token re-issue endpoint (`POST /calls/:id/rejoin`) would fix this.
- No pagination on the patient list (20 per doctor); messages are capped at the latest 100.
- No audit log of record access. A real EHR would need one, along with HIPAA-grade hosting.
