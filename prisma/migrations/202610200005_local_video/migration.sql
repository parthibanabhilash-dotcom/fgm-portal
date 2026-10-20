CREATE TABLE "VideoAsset" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VideoAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VideoAsset_valid_file" CHECK ("size" > 0 AND "size" <= 1073741824 AND "mime" IN ('video/mp4', 'video/webm'))
);
CREATE UNIQUE INDEX "VideoAsset_lessonId_key" ON "VideoAsset"("lessonId");
CREATE UNIQUE INDEX "VideoAsset_key_key" ON "VideoAsset"("key");
ALTER TABLE "VideoAsset" ADD CONSTRAINT "VideoAsset_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
