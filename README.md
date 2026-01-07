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
