# Workforce Replacement Tracker

This repository contains a fresh Next.js (App Router) starter for the Workforce Replacement Tracker rebuild.

## Requirements
- Node.js 18 or 20

## Setup
```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## Step 2: Supabase connectivity
Create a `.env.local` file with the following variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Visit `/api/dev/health` to verify connectivity. A successful response looks like:
```json
{
  "ok": true,
  "supabaseUrlPresent": true,
  "serviceKeyPresent": true,
  "queryOk": true
}
```

You can also open `/dev/health` for a simple UI that shows the status and raw JSON.

File tree additions:
```
app/api/dev/health/route.ts
app/dev/health/page.tsx
lib/supabaseServer.ts
```

## Step 3: Supabase auth + profiles
Update `.env.local` with the browser anon key:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Apply the SQL in `sql/step3_profiles.sql` to create the `profiles` table, trigger, and RLS policies.

Run the app and use:
- `/login` to sign in or sign up.
- `/me` to view your email + profile role and log out.

## Step 4: Team lead absence reporting
1. Apply the SQL in `sql/step4_core.sql` to create `teams`, `workers`, and `absence_cases` with RLS policies.
2. Assign a team to a team lead profile (replace the user id):

```sql
update public.profiles
set team_id = (select id from public.teams where name = 'Team 1' limit 1)
where id = 'YOUR_USER_ID';
```

3. Run the app and, as a team lead, use:
   - `/team/report` to report a missing/absent worker.
   - `/team/cases` to see the last 20 cases for the team.

## Step 5: HR Province SLA dashboard
1. Apply the SQL in `sql/step5_hr.sql` to extend `absence_cases` with HR tracking fields and add HR Province RLS.
2. Run the app and, as an HR Province user, open `/hr/dashboard` to review cases.
3. Click "Receive & Send Document" to set `hr_received_at`, mark `document_sent`, and start the 3-business-day SLA.

SLA logic: the API calculates `sla_deadline_at` as three business days (excluding Saturday and Sunday) from the HR receive timestamp.

## Step 6: HR Province outcome tracking (no recruitment UI)
1. Apply the SQL in `sql/step6_hr_outcome.sql` to extend `absence_cases` with recruitment outcome fields and add vacancy tracking.
2. Run the app and, as an HR Province user, open `/hr/dashboard`.
3. Record the outcome based on external documents:
   - "Record Found" stores the replacement name + start date.
   - "Record Not Found" stores the outcome.
4. If a replacement is found within the SLA, click "Approve Swap" to close the case.
5. If no replacement is found and the SLA has expired, click "Mark Vacant" to start a vacancy period the day after the SLA deadline.

## Step 7: Team workforce dashboard + roster control
1. Apply the SQL in `sql/step7_ops_memberships.sql` to create `team_memberships` and link them to absence cases.
2. Run the app and, as a team lead, open `/team/dashboard`.
3. Use the dashboard to add or remove active team members without HR involvement.
   - Adding a member creates a worker and an active membership.
   - Removing a member sets the membership inactive (with reason) and marks the worker status as inactive.
4. Current headcount on the dashboard is based on active memberships (inactive memberships do not count).
5. Active members show their latest HR case status directly in the roster table.
