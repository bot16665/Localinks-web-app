# LocalLink

> Your neighborhood, connected.

LocalLink is a community app that connects neighbors with local shops, activities, and each other — built with the Next.js App Router, Supabase, and Tailwind CSS.

## Features

- 🔐 Google OAuth sign-in via Supabase Auth
- 🏪 Local business listings — create, browse, and edit your own business
- 🏃 Neighborhood activities feed
- 💬 Neighbor chat / community connection
- 🎨 Custom design-token theme (dark palette) built on Tailwind CSS v4
- 📱 Fully responsive, mobile-first UI

## Tech Stack

| Layer      | Tech                                  |
|------------|----------------------------------------|
| Framework  | [Next.js](https://nextjs.org) (App Router) |
| Styling    | [Tailwind CSS v4](https://tailwindcss.com) with custom `@theme` design tokens |
| Backend    | [Supabase](https://supabase.com) (Auth, Postgres, RLS) |
| Language   | TypeScript |
| Fonts      | Inter (self-hosted via `next/font`), Material Symbols |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Installation

```bash
git clone https://github.com/<your-username>/locallink.git
cd locallink
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` is used only by the account-deletion Route Handler. Never prefix it with `NEXT_PUBLIC_` or expose it to client code.

### Apply the current Supabase SQL changes

The SQL files in `supabase/migrations/` are manual SQL scripts, not automatically applied by `npm run dev`. In the Supabase SQL Editor, apply the following additions in order after the existing schema and older migrations:

1. `Separate current and home location.sql`
2. `Geolocation and business privacy.sql`
3. `Public profile privacy.sql`
4. `Persist discovery preferences.sql`
5. `Chat authorization hardening.sql`
13. `Chat delete policy.sql`
14. `Storage upload restrictions.sql`
15. `Business image owner delete policy.sql`
16. `Enable Realtime tables.sql`
17. `Cascade chats when posts are deleted.sql`
The nearby business/activity feeds require the first migration; the community author lookup requires the third. The storage script expects the `business-images` and `community-images` buckets to exist. Create any missing bucket in Supabase Storage before relying on uploads.

### Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
app/
├── layout.tsx              # Root layout, fonts, metadata
├── globals.css             # Tailwind + design tokens (@theme)
├── page.tsx                # Login page
├── auth/
│   └── callback/            # Supabase OAuth callback
├── business/
│   ├── new/page.tsx         # Create business
│   └── [id]/edit/page.tsx   # Edit business
├── activities/
│   └── new/page.tsx         # Create activity
lib/
└── supabase.ts              # Supabase client (createClient)
```

## Database Schema (Supabase)

Core tables:

- **profiles** — user profile data, including location
- **businesses** — `owner_id`, `name`, `category`, `description`, `open_time`, `close_time`, `address`, `location`, `is_open`
- **activities** — neighborhood activities/events

> Row Level Security (RLS) is enabled on all tables. Make sure `SELECT`/`INSERT`/`UPDATE` policies exist for the relevant owner-scoped operations before testing forms locally.

## Scripts

| Command         | Description                  |
|-----------------|-------------------------------|
| `npm run dev`   | Start local dev server        |
| `npm run build` | Production build              |
| `npm run start` | Start production server       |
| `npm run lint`  | Run ESLint                    |

## Design Reference

A `design-reference/` folder in this repo contains the source design files. If you want to make UI changes, check there first for the intended look and feel — feel free to update it and have fun with it! 🎨

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Open a pull request
