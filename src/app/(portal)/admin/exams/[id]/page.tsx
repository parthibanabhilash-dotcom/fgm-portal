import { notFound, redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
export default async function EditExam({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const exam = await db.exam.findUnique({ where: { id }, select: { courseId: true } });
  if (!exam) notFound();
  redirect(`/admin/courses/${exam.courseId}#exam-${id}`);
}
