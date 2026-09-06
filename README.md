# Forming Material / Press-Forming

A collaborative research atlas and experimental archive for the Architectural Products Lab. The first build focuses on thin-sheet forming with 3D-printed tooling, compliant / rigid tool sequences, multi-stage press operations, and undercut / re-entrant geometries.

## What v1 already does

- Public research-atlas landing page
- Experimental archive with FM-### numbering
- Researcher sign-up / sign-in through Supabase Auth
- Multi-stage experiment submission
- Per-stage tool material, operation, force, restraint, and observations
- Image uploads to a private Supabase Storage bucket
- Draft → Submitted → Reviewed → Published workflow
- Admin review queue
- Experiment detail pages with signed image URLs
- Parent-experiment field in the database for future lineage / evolutionary-tree views
- Research-source table for precedent → principle → translation records

## 1. Create local environment variables

Copy `.env.example` to `.env.local` and enter the Supabase project values:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Do not commit `.env.local`.

## 2. Build the Supabase database

Open your Supabase project → SQL Editor → New query.

Run the complete contents of:

`supabase/schema.sql`

Then optionally run:

`supabase/seed.sql`

The schema creates:

- `profiles`
- `experiments`
- `experiment_stages`
- `experiment_media`
- `research_sources`
- RLS policies
- `experiment-media` private storage bucket
- automatic FM-001, FM-002… numbering
- auth profile trigger

## 3. Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## 4. Create the first user

Open `/login` and create your account. If Supabase email confirmation is enabled, confirm the email before signing in.

To promote your account to administrator, run this in Supabase SQL Editor after the account exists:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
```

Do not expose student emails in the public database. The public `profiles` table intentionally stores only name, affiliation, and role.

## 5. Test FM-001

1. Sign in.
2. Open `/submit`.
3. Enter an experiment title, material, and research question.
4. Add at least two press stages, e.g. rigid PLA pre-form → TPU compliant stage.
5. Upload one or more images.
6. Save as `draft` or `submitted`.
7. Open the experiment page and verify the data persists.
8. As admin, open `/admin/review` and publish it.
9. Sign out / use an incognito browser and confirm the published experiment is publicly visible.

## 6. Connect to Vercel

In Vercel:

1. Add New → Project.
2. Import `whiteD1968/Press-Forming`.
3. Add these Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Deploy.
5. In Supabase Auth → URL Configuration, add the Vercel deployment URL as an allowed redirect / site URL.

After that, GitHub code changes trigger Vercel deployments. Student experiment submissions update Supabase directly and do **not** require a new deployment.

## Research structure carried into the build

The site begins with the project framing already developed in the Miro board and undercut research thread:

`flat sheet → rigid pre-form → constrained form → compliant / redirected displacement → undercut / re-entrant geometry → calibration`

Each experiment is therefore not a single result row. It is a sequence of transformations with stage-specific tool behavior and observations.

## Next development priorities

1. Controlled taxonomies for sheet materials, tool materials, operations, and failure modes.
2. Experiment editing and versioning.
3. Image captions / media classification at upload.
4. Parent/child experiment lineage visualization.
5. Precedent library with verified citations and source links.
6. Side-by-side experiment comparison.
7. Quantitative charts for undercut depth, springback, tool hardness, infill, and force.
8. Image compression on upload to protect free-tier storage.
9. Optional FAU-domain account restriction.

## Repository deployment note

The normal ChatGPT GitHub connector can read this repository but may not push code directly. This build can be copied into the repository with Cursor, Codex, GitHub Desktop, or the Git command line, then Vercel can deploy it automatically.
