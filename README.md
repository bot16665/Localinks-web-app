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
```

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

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Open a pull request
