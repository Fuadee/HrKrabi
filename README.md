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
