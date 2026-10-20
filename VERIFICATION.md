# Verification record

Environment: Windows, Node.js 22.23.3, Next.js 16.4.2, React 19.3.1, Prisma 6.19.0, PostgreSQL 17.6. Tests use a separate `lkp_test` PostgreSQL database. The application database is `lkp`.

## Checks performed

| Check | Result |
| --- | --- |
| Prisma client generation | Passed |
| Five committed migrations applied to application and test databases | Passed |
| Database-to-Prisma schema diff | No difference detected |
| Demo seed | Passed; one admin, one student, three modules, six lessons, ten final-exam questions |
| Repeat seed | Passed without replacing existing records |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed; all application and API routes compiled |
| Unit tests | 7 passed |
| PostgreSQL integration tests | 7 scenario groups passed, plus parent test (8 reported tests) |
| Chromium browser tests against production build | 6 workflows passed, including a targeted rerun of video resume after fixing the initialization timing |
| Dependency audit | 0 vulnerabilities |
| Worker executable | Started successfully; polling service smoke-tested and then stopped |
| Visual inspection | Desktop and mobile dashboard screenshots inspected; tablet/mobile document overflow checked automatically |

## Coverage

- Password login, public student registration (including an injected admin-role field), logout, profile updates, protected routes, inactive accounts, and student/admin separation.
- Enrollment restrictions for lessons, progress, exam starts, and attachment download requests. Unauthenticated attachment requests are rejected.
- Progress persistence, saved playback position records, sequential lesson access, course publication changes, and enrollment revocation.
- Admin course creation, module and lesson creation, module reordering, Markdown notes, CSV authorization/export, and mobile admin layout.
- Exam start confirmation, concurrent starts, stable randomized question order, answer autosave and reload recovery, ownership restrictions, invalid choices, weighted server scoring, immutable snapshots, duplicate submissions, availability dates, attempt limits, browser timer expiry, and closed-browser expiry finalization.
- No answer-key fields in student responses before release; review timing unit tests cover immediate, after-close, and never policies.
- PDF signature/MIME/extension/size validation, CSV formula neutralization, and cross-origin mutation rejection.
- Local video upload to persistent disk, file type/size checks, failed-upload cleanup, protected streaming, full and partial byte responses, HEAD, and removal.
- A generated, playable WebM file was uploaded through the admin UI and played through the student lesson page. Byte-range access, saved-position resume, progress saving after playback, upload-role restrictions, and video access after enrollment revocation were verified.
- Admin creation of an original MCQ exam, question text, choices, correct answer, marks, and publication were verified through the browser.

The database tests run the exact finalization service used by the worker, including repeated expiry cycles and access-triggered expiry. Browser timer tests shorten a test attempt's deadline directly in the isolated database, then verify the application submits it and displays its result.

## Verification limits and setup requirements

- Docker is not installed in this environment. A real MinIO/S3 upload → stored object → signed download round trip was **not run**. Compose configuration, persistent private-storage implementation, PDF input validation, and access-denial paths are included; start MinIO or configure your S3 provider before uploading PDFs.
- No user-supplied video or PDF media was provided. Local WebM upload/playback/resume was tested with a generated test recording; actual MP4 codecs, external YouTube/Vimeo playback, provider-specific resume, speed options, and fullscreen behavior were **not tested with user media**. Test your approved files after adding them. Reliable seeking/resume requires duration/index metadata; raw recordings may need re-exporting. Demo course placeholders remain intentional.
- Browser automation used Chromium, with responsive checks at desktop, 820px, and 390px widths. Safari, Firefox, physical mobile devices, and assistive-technology audits were not performed.
- Browser tests cover core admin create/reorder flows and exam/question creation/publication. Enrollment/deactivation form permutations and every question-edit permutation were not exercised in the browser; server validation and role checks cover these operations.
- Production HTTPS, external deployment, large-scale load, backup restoration, and failover were not exercised. Deployment is not part of this local delivery.

Prisma tooling dependencies `deepmerge-ts` and `effect` are overridden to patched releases; migration/generation/build checks passed with these overrides. ESLint uses TypeScript and React Hooks rules without the vulnerable Next lint-plugin glob chain. Framework/runtime versions and the package lock are pinned for reproducible installation.

Admin edit/delete follow-up: TypeScript, lint, and production build passed. The extended MCQ browser workflow passed: course and exam title edits, canceled and confirmed deletion, exam restoration as an unpublished draft, course removal from the active list, and question retention after archival. Local login returned HTTP 200.

Company intern-training refresh: updated interface terminology and green/white/grey branding. TypeScript, lint, production build, and all 6 Chromium workflows passed. Live admin/intern dashboards and login were checked; 820px and 390px views had no page overflow. Exam, assignment/access, course editing, local video playback/resume, and deletion/restoration flows passed with the updated labels.

Mobile app-style interface: lint and production build (including TypeScript) passed; all 6 Chromium workflows passed. Mobile checks cover fixed bottom navigation, course navigation, lesson-outline expand/collapse, notes, and the complete exam autosave/refresh/submit/expiry workflow at 390px. Screenshots of dashboard, lesson, result cards, and exam were visually reviewed. Live pages had no page overflow at 360px, 390px, or 768px; desktop lesson outline remained visible. Actual iOS/Android devices and offline operation were not tested.
