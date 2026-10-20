# FGM Training - intern onboarding portal

Company training portal for newly joining interns: assigned courses, lessons, notes, and exams. The interface uses the reference company green, white, and grey palette. Existing STUDENT database roles and /admin/students URLs are retained internally for compatibility; the interface calls these accounts Interns. Existing demo login credentials remain valid.

# LKP Academy LMS

A working Next.js App Router / TypeScript / Tailwind application with PostgreSQL, Prisma, database-backed sessions, persistent private PDF storage, student learning, timed assessments, and administration. No payment integration is included.

## Requirements

- Node.js **22.12 or newer**, npm, and Docker Desktop with Compose; or existing PostgreSQL 17 and an S3-compatible object store.
- PostgreSQL and object storage must persist across application restarts. Docker Compose uses named volumes, bound only to loopback.
- The web process and expiry worker must use the same PostgreSQL database and an accurate system clock.

## Installation and local run

From this project directory:

```powershell
npm ci
Copy-Item .env.example .env
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

On macOS/Linux replace `Copy-Item .env.example .env` with `cp .env.example .env`. Open **http://localhost:3000**. In a second terminal, from this directory, run:

```powershell
npm run worker
```

Keep the worker running. It checks expiry every five seconds and retries failures. A deadline is enforced on the server even between worker cycles. Reading an overdue attempt also finalizes it. Multiple workers are safe because finalization locks each attempt and is idempotent.

The MinIO console is **http://localhost:9001**, using the local storage credentials in `.env.example`. The private bucket is created on the first valid admin PDF upload. Do not enable public bucket access. No fake videos or PDF files are seeded.

If PostgreSQL or storage already exists, skip Compose and edit `.env`. Set `APP_URL` to the exact browser origin, with scheme and port. For example, `localhost` and `127.0.0.1` are different origins. The storage endpoint must also be reachable by the browser because PDF downloads use signed URLs.

### Demo accounts (development only)

| Role | Email | Default password |
| --- | --- | --- |
| Admin | `admin@lkpacademy.test` | `AdminDemo!2026` |
| Student | `student@lkpacademy.test` | `StudentDemo!2026` |

The student is enrolled in **Certificate in Digital Marketing Basics**, containing three modules, six lessons, Markdown notes, and a ten-question final exam. Real video and PDF resources are labelled placeholders. Add real media through the admin course editor.

Set `DEMO_ADMIN_PASSWORD` and `DEMO_STUDENT_PASSWORD` before the first seed if you want different passwords. Rerunning the seed preserves existing accounts, course edits, enrollments, attempts, and progress. It does not reset passwords. Seeding is blocked with `NODE_ENV=production` unless explicitly allowed; never enable demo accounts on a public deployment.

### Runtime prepared in this workspace

During implementation, a portable Node runtime and a loopback-only PostgreSQL cluster were provisioned outside the repository under `%LOCALAPPDATA%\lkp-tools`. They are convenience tools for this machine, not project dependencies. If Node is still absent from your PATH, start a PowerShell terminal with:

```powershell
$env:PATH = "$env:LOCALAPPDATA\lkp-tools\node-v22.23.3-win-x64;$env:PATH"
```

To start that PostgreSQL cluster after a reboot:

```powershell
& "$env:LOCALAPPDATA\lkp-tools\postgres-runtime\pgsql\bin\pg_ctl.exe" -D "$env:LOCALAPPDATA\lkp-tools\pgdata" -l "$env:LOCALAPPDATA\lkp-tools\postgres.log" -o "-p 5432 -h 127.0.0.1" start
```

Use either this cluster or the Compose database on port 5432. Stop the portable cluster before starting Compose's database:

```powershell
& "$env:LOCALAPPDATA\lkp-tools\postgres-runtime\pgsql\bin\pg_ctl.exe" -D "$env:LOCALAPPDATA\lkp-tools\pgdata" stop
```

## Production build

```powershell
npm ci
npm run db:generate
npm run db:migrate
npm run build
npm start
```

Run `npm run worker` as a separate supervised process. Set `APP_URL` to the HTTPS public origin. Production session cookies require HTTPS. Use production database/storage credentials, restrict database access, and configure your reverse proxy to allow at most 22 MB request bodies. Do not expose the MinIO console or database publicly.

Provision an admin without running the demo seed:

```powershell
$env:ADMIN_EMAIL = 'admin@your-academy.example'
$env:ADMIN_NAME = 'Academy Administrator'
$env:ADMIN_PASSWORD = 'ReplaceWithAUniqueLongPassword'
npx tsx scripts/create-admin.ts
Remove-Item Env:ADMIN_PASSWORD
```

The command creates a new account and does not silently promote or replace an existing user.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL Prisma connection string; URL-encode special characters in credentials |
| `APP_URL` | Canonical web origin for mutation/CSRF checks |
| `S3_ENDPOINT` | S3/MinIO endpoint; browser-accessible for signed downloads |
| `S3_REGION` | Storage region, `us-east-1` locally |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Private storage credentials |
| `S3_BUCKET` | Private bucket name |
| `S3_FORCE_PATH_STYLE` | `true` for MinIO; adapt for your provider |
| `VIDEO_STORAGE_DIR` | Optional absolute persistent directory for local video uploads; defaults to `<OS user home>/.lkp-academy/videos` |
| `TEST_DATABASE_URL` | Separate migrated and seeded PostgreSQL database for automated integration/browser tests |

Environment variables are server-only; `.env` is ignored by Git. A session contains a cryptographically random opaque token; only its SHA-256 digest is stored in PostgreSQL. Sessions last seven days. Password changes revoke other sessions. Deactivated accounts fail authorization immediately.

## Using the application

- Students register at `/register`. Registration does not grant enrollment or admin privileges.
- Admins use `/admin` to create courses, modules, lessons, and exams. Course editors support reorder controls, formatted Markdown, video URLs, and private PDF uploads.
- To add your own local course video: **Admin → Courses → Manage → expand a lesson → Upload video from your computer**. Select an MP4/WebM file (up to 1 GB) and click **Upload video**. You do not need MinIO for local video uploads. Uploading replaces the previous uploaded file after confirmation; the original file on your computer is untouched.
- To create your own question paper: **Admin → Courses → Manage → Create an exam**. Create a draft, then use the exam section on the same course page to add your questions/options/correct answers/marks. Publish under **Edit exam**. Lesson exams and final-course exams are supported.
- Enroll or revoke students through **Students → student record → course enrollment**. Enrollment and completion records are retained when revoked.
- Courses must be published before enrolled students can access learning content. Unenrolled students see public course metadata and a “Not enrolled” state.
- Exam creation starts as a draft. Add questions, then publish in exam settings. Single-answer questions require 2–8 choices and exactly one correct answer.
- Availability is entered in **UTC** in admin forms. Student dates are displayed in **IST**. The earlier of the duration deadline and availability closing time ends an attempt.
- Course completion means all current lessons were explicitly marked completed. Exam pass/fail is separate; no certificate PDF is generated.
- Archiving courses blocks learning access but preserves records. Archiving exams blocks new attempts; existing attempts/results remain accessible while course enrollment remains valid. Revoked enrollments prevent student result access; admins retain historical access.
- Exam edits affect new attempts only. Titles, pass marks, questions, answer keys, question order, and review-release settings are captured in each attempt snapshot. A closing-date change does not change an existing attempt's deadline or review-release date.
- CSV export includes all attempts and neutralizes spreadsheet-formula prefixes.

## Checks and tests

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Integration and browser tests require an **isolated** database. Do not point `TEST_DATABASE_URL` at production. Browser tests seed/read demo accounts and update the test student's progress. Integration tests create and remove their own fixtures.

Example with Compose PostgreSQL:

```powershell
docker compose exec db createdb -U lkp lkp_test
$env:TEST_DATABASE_URL = 'postgresql://lkp:lkp_local_password@localhost:5432/lkp_test?schema=public'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:migrate
npm run db:seed
Remove-Item Env:DATABASE_URL
npm run test:integration
npx playwright install chromium
npm run build
npm run test:e2e
```

Playwright launches the production build on port **3100**, sets the matching origin, and uses `TEST_DATABASE_URL`. Build before running browser tests and ensure port 3100 is free. Chromium accepts secure cookies on localhost for this test setup. See [VERIFICATION.md](VERIFICATION.md) for actual verification results and coverage limits from this implementation session.

## Security and operating notes

- Every content request and mutation checks the current active user. Admin mutations check the role; learning, progress, documents, and exams check enrollment. Attempts additionally check ownership.
- Raw HTML in notes is not rendered. Markdown links use the renderer's safe URL transformation. PDFs are validated by extension, MIME, size (20 MB), and `%PDF-` signature. This is file-type validation, not malware scanning; add a scanning/quarantine service for untrusted administrators.
- Private PDFs are downloaded through authorization and a 60-second presigned URL. A previously issued link may work until it expires after enrollment revocation. Production storage principals should have only the required bucket permissions; precreate the bucket if creation is not permitted.
- Direct video URLs, YouTube, and Vimeo are external resources. Their owners control availability, domain restrictions, and privacy. URLs may be discoverable and shareable; the LMS does not provide DRM or hide third-party media URLs. Use a protected streaming provider for stronger media control.
- Uploaded videos are streamed through `/api/videos/<lesson-id>` with session, enrollment, and sequential-lesson checks on every request. Byte-range requests support seeking without downloading the entire video at once. An uploaded file takes priority over a lesson's external URL; remove the uploaded file to switch back to the URL.
- Videos persist in `<OS user home>/.lkp-academy/videos`, outside this project and its build folders. Set `VIDEO_STORAGE_DIR` to an absolute persistent path if needed. Back this directory up with the database. In containers or multiple web instances, mount the same persistent volume at that path for every instance; do not use ephemeral/serverless disk. Your reverse proxy must allow **1 GB video uploads** on `/api/admin/videos/*` with an appropriate timeout (other requests can keep the 22 MB limit). Files are streamed to disk, not buffered entirely in memory.
- MP4 and WebM container signatures, MIME types, extensions, and sizes are checked. Codec compatibility still depends on the browser; H.264/AAC MP4 is recommended. MOV/AVI files must be converted before upload. Local video uploads require available disk space and OS write permission in the configured storage directory.
- Reliable seeking/resume also requires duration/index metadata in the video container. Raw browser recordings may omit it; re-export/remux those files before publishing. The player warns when duration metadata is unavailable.
- HTML video, the YouTube iframe API, and Vimeo messaging restore/save position when the provider supports it. Saves occur about every ten seconds and on supported pause events. A sudden browser close may lose the latest unsaved seconds. Vimeo speed control depends on provider/account capabilities.
- Only the active lesson player is mounted; course lists never preload all videos. Incompatible codecs, blocked third-party scripts, or disabled embeds are surfaced as playback errors.
- Email verification, password-reset email, MFA, proctoring, advanced analytics, pagination for large datasets, and payment processing are outside this version. Administrators cannot view student passwords. For a public launch, establish an account-recovery process and tune the shared account-based rate limiter to your traffic.
- Back up PostgreSQL with `pg_dump` and restore-test regularly. Back up/version the private storage bucket separately. Keep both named volumes when upgrading; `docker compose down` preserves them, while `docker compose down -v` destroys them.
- Monitor web errors, database capacity, worker logs, and overdue attempts. Deploy the web process and worker from the same code/schema version. Apply committed migrations before restarting either process.

Admin course rows have Edit course and Delete course actions. Each exam has Edit exam and Delete exam controls on the course page. Delete requires confirmation and archives content, preserving enrollments, progress, and exam history. Deleted / archived sections allow restoring courses through publication settings, or exams as drafts.

Mobile interface: screens up to 768px use a fixed bottom navigation bar, compact sticky header, safe-area spacing, large touch controls, collapsible lesson outline, and card-style intern result history. Exam timers remain sticky below the header. The portal is a responsive web application; native app installation and offline course playback are not included.
