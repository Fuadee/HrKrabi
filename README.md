# Workforce Replacement Tracker (Next.js + Supabase)

This MVP tracks missing/absent workforce cases and enforces the 3 business day SLA starting from the date HR_PROV sends documents to HR_REGION (`doc_sent_to_region_date`).

## Features
- Team leads report cases with one-click submission.
- HR Provincial sends documents to HR_REGION + RECRUITMENT, starting SLA countdown.
- Recruitment updates replacement results within the SLA window.
- HR Provincial confirms substitution or removal and tracks vacancy penalties.

## Setup

### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment
Create a `.env.local` file:
```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_VACANCY_COUNT_MODE=calendar
```
`NEXT_PUBLIC_VACANCY_COUNT_MODE` accepts `calendar` (default) or `business`.

### 3) Apply database schema
Run in Supabase SQL editor:
- `sql/schema.sql`
- `sql/seed.sql`

Create a Supabase Storage bucket named `documents` (private).

### 4) Run the app
```bash
npm run dev
```

## Workflow overview
- TEAM_LEAD reports a case from `/team/report`.
- HR_PROV sends documents from `/hr/dashboard`, which:
  - Generates 2 PDFs, stores them in Supabase Storage.
  - Inserts rows in `documents`.
  - Sets `doc_sent_to_region_date` and `replacement_deadline_date = addBusinessDays(today, 3)`.
  - Updates `case_status = WAIT_REPLACEMENT`.
- RECRUITMENT updates replacement result on `/recruitment/cases`.
- HR_PROV closes the case:
  - **Found on/before deadline** → generate substitution approval PDF, mark closed.
  - **Not found after deadline** → generate remove-from-system PDF, confirm removal, set `system_exit_date`, start vacancy counting.

## RLS summary
Policies are defined in `sql/schema.sql`:
- TEAM_LEAD: view/insert cases for their own team only.
- RECRUITMENT: view cases in `WAIT_REPLACEMENT`, update recruitment fields.
- HR_PROV: full access.
- VIEWER: read-only.

## Notes
- The UI uses server-side Supabase Admin client for simplicity. For production, wire up Supabase Auth sessions and use the anon client with RLS enforcement.
