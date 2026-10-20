-- Use timezone-aware instants consistently, including raw SQL and database defaults.
ALTER TABLE "User" ALTER COLUMN "createdAt" TYPE timestamptz(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Session" ALTER COLUMN "expiresAt" TYPE timestamptz(3) USING "expiresAt" AT TIME ZONE 'UTC';
ALTER TABLE "RateLimit" ALTER COLUMN "resetAt" TYPE timestamptz(3) USING "resetAt" AT TIME ZONE 'UTC';
ALTER TABLE "Course" ALTER COLUMN "createdAt" TYPE timestamptz(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Enrollment" ALTER COLUMN "createdAt" TYPE timestamptz(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "LessonProgress" ALTER COLUMN "updatedAt" TYPE timestamptz(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Exam" ALTER COLUMN "availableFrom" TYPE timestamptz(3) USING "availableFrom" AT TIME ZONE 'UTC', ALTER COLUMN "availableUntil" TYPE timestamptz(3) USING "availableUntil" AT TIME ZONE 'UTC';
ALTER TABLE "ExamAttempt" ALTER COLUMN "startedAt" TYPE timestamptz(3) USING "startedAt" AT TIME ZONE 'UTC', ALTER COLUMN "deadline" TYPE timestamptz(3) USING "deadline" AT TIME ZONE 'UTC', ALTER COLUMN "submittedAt" TYPE timestamptz(3) USING "submittedAt" AT TIME ZONE 'UTC';
ALTER TABLE "StudentAnswer" ALTER COLUMN "updatedAt" TYPE timestamptz(3) USING "updatedAt" AT TIME ZONE 'UTC';
-- Rate-limit windows are transient and may have used a local database default previously.
DELETE FROM "RateLimit";
