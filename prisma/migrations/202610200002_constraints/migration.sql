ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized" CHECK ("email" = lower(trim("email")) AND length("email") <= 254);
ALTER TABLE "Module" ADD CONSTRAINT "Module_positive_position" CHECK ("position" > 0);
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_positive_position" CHECK ("position" > 0);
ALTER TABLE "Question" ADD CONSTRAINT "Question_valid_numbers" CHECK ("position" > 0 AND "marks" > 0);
ALTER TABLE "Choice" ADD CONSTRAINT "Choice_positive_position" CHECK ("position" > 0);
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_pdf_size" CHECK ("size" > 0 AND "size" <= 20971520);
ALTER TABLE "LessonProgress" ADD CONSTRAINT "Progress_valid_position" CHECK ("position" >= 0 AND "position" <= 604800);
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_valid_configuration" CHECK (
  "durationMinutes" BETWEEN 1 AND 1440 AND "passPercentage" BETWEEN 1 AND 100 AND "maxAttempts" BETWEEN 1 AND 100
  AND ("availableFrom" IS NULL OR "availableUntil" IS NULL OR "availableFrom" < "availableUntil")
  AND ("release" <> 'AFTER_CLOSE' OR "availableUntil" IS NOT NULL)
);
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "Attempt_valid_result" CHECK (
  ("status" = 'ACTIVE' AND "score" IS NULL AND "passed" IS NULL AND "submittedAt" IS NULL)
  OR ("status" = 'SUBMITTED' AND "score" BETWEEN 0 AND 100 AND "passed" IS NOT NULL AND "submittedAt" IS NOT NULL)
);
CREATE UNIQUE INDEX "Attempt_one_active_per_student_exam" ON "ExamAttempt" ("userId", "examId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "Choice_one_correct" ON "Choice" ("questionId") WHERE "correct" = true;

CREATE FUNCTION validate_published_exam() RETURNS trigger AS $$
DECLARE target_id text;
BEGIN
  IF TG_TABLE_NAME = 'Exam' THEN
    target_id := COALESCE(NEW."id", OLD."id");
  ELSIF TG_TABLE_NAME = 'Question' THEN
    target_id := COALESCE(NEW."examId", OLD."examId");
  ELSE
    SELECT "examId" INTO target_id FROM "Question" WHERE "id" = COALESCE(NEW."questionId", OLD."questionId");
  END IF;
  IF EXISTS (SELECT 1 FROM "Exam" WHERE "id" = target_id AND "published" AND NOT "archived") THEN
    IF NOT EXISTS (SELECT 1 FROM "Question" WHERE "examId" = target_id) OR EXISTS (
      SELECT q."id" FROM "Question" q LEFT JOIN "Choice" c ON c."questionId" = q."id"
      WHERE q."examId" = target_id GROUP BY q."id"
      HAVING count(c."id") < 2 OR count(c."id") FILTER (WHERE c."correct") <> 1
    ) THEN RAISE EXCEPTION 'Published exams require questions with two or more choices and exactly one correct answer'; END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "Exam_content_valid" AFTER INSERT OR UPDATE ON "Exam" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_published_exam();
CREATE CONSTRAINT TRIGGER "Question_content_valid" AFTER INSERT OR UPDATE OR DELETE ON "Question" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_published_exam();
CREATE CONSTRAINT TRIGGER "Choice_content_valid" AFTER INSERT OR UPDATE OR DELETE ON "Choice" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_published_exam();

CREATE FUNCTION validate_exam_lesson() RETURNS trigger AS $$
BEGIN
  IF NEW."lessonId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Lesson" l JOIN "Module" m ON m."id" = l."moduleId"
    WHERE l."id" = NEW."lessonId" AND m."courseId" = NEW."courseId"
  ) THEN RAISE EXCEPTION 'Exam lesson must belong to the exam course'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Exam_lesson_course" BEFORE INSERT OR UPDATE ON "Exam" FOR EACH ROW EXECUTE FUNCTION validate_exam_lesson();

CREATE FUNCTION preserve_attempt_snapshot() RETURNS trigger AS $$
BEGIN
  IF NEW."snapshot" IS DISTINCT FROM OLD."snapshot" OR NEW."userId" <> OLD."userId" OR NEW."examId" <> OLD."examId" THEN
    RAISE EXCEPTION 'Historical exam snapshots and ownership are immutable';
  END IF;
  IF OLD."status" = 'SUBMITTED' AND (NEW."status" <> OLD."status" OR NEW."score" IS DISTINCT FROM OLD."score" OR NEW."passed" IS DISTINCT FROM OLD."passed" OR NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt") THEN
    RAISE EXCEPTION 'Submitted exam results are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Attempt_preserve_history" BEFORE UPDATE ON "ExamAttempt" FOR EACH ROW EXECUTE FUNCTION preserve_attempt_snapshot();
