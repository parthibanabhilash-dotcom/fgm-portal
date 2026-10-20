import { adminAction } from '@/app/actions';
import { ActionForm, Hidden } from './forms';

export function DeleteContent({ id, kind, title }: { id: string; kind: 'course' | 'exam'; title: string }) {
  const explanation = kind === 'course'
    ? 'Interns will lose access to this course. Enrollment, progress, and exam results will be preserved in the archive.'
    : 'Interns cannot start this exam again. Existing attempts and results will be preserved in the archive.';
  return <ActionForm action={adminAction} button={`Delete ${kind}`} className="delete-content"
    confirm={`Delete "${title}"?\n\n${explanation}`}>
    <Hidden name="op" value={kind === 'course' ? 'deleteCourse' : 'deleteExam'} />
    <Hidden name="id" value={id} />
    <Hidden name="confirm" value="on" />
  </ActionForm>;
}
