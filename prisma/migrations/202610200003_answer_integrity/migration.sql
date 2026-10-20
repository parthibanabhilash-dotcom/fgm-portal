ALTER TABLE "ExamAttempt" DROP CONSTRAINT "Attempt_valid_result";
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "Attempt_valid_result" CHECK (
  ("status" = 'ACTIVE' AND "score" IS NULL AND "passed" IS NULL AND "submittedAt" IS NULL)
  OR ("status" = 'SUBMITTED' AND "score" IS NOT NULL AND "score" BETWEEN 0 AND 100 AND "passed" IS NOT NULL AND "submittedAt" IS NOT NULL)
);

CREATE FUNCTION validate_student_answer() RETURNS trigger AS $$
DECLARE attempt_row "ExamAttempt";
BEGIN
  SELECT * INTO attempt_row FROM "ExamAttempt" WHERE "id" = NEW."attemptId" FOR UPDATE;
  IF NOT FOUND OR attempt_row."status" <> 'ACTIVE' OR attempt_row."deadline" <= clock_timestamp() THEN
    RAISE EXCEPTION 'Attempt is no longer accepting answers';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(attempt_row."snapshot"->'questions') q,
    LATERAL jsonb_array_elements(q->'choices') c
    WHERE q->>'id' = NEW."questionId" AND c->>'id' = NEW."choiceId"
  ) THEN RAISE EXCEPTION 'Answer must belong to a question and choice in the attempt snapshot'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Answer_snapshot_integrity" BEFORE INSERT OR UPDATE ON "StudentAnswer" FOR EACH ROW EXECUTE FUNCTION validate_student_answer();
