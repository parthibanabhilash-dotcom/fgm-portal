import 'server-only';
import { DeleteContent } from './delete-content';
import type { Exam, Question, Choice } from '@prisma/client';
import { ExamEditor, QuestionEditor } from './admin-editors';
import { ActionForm, Hidden, Check } from './forms';
import { adminAction } from '@/app/actions';
export function ExamContentEditor({ exam, lessons }: { exam: Exam & { questions: (Question & { choices: Choice[] })[] }; lessons: { id: string; title: string }[] }) {
const id = exam.id;
return <>{!exam.archived && <div className="content-actions"><DeleteContent kind="exam" id={id} title={exam.title} /></div>}{exam.archived && <p className="notice">This exam is archived. It remains in historical records and cannot accept new attempts.</p>}<details className="details"><summary>Edit exam</summary><p className="muted">Exam settings & publication</p><ExamEditor exam={exam} courseId={exam.courseId} lessons={lessons} /></details><div className="section-header" style={{ marginTop: 30 }}><h2>Questions</h2><span className="badge">{exam.questions.length} QUESTIONS</span></div>{exam.questions.map((q, i) => <details className="details" key={q.id}><summary>{i + 1}. {q.text} <span className="muted small">({q.marks} marks)</span></summary><QuestionEditor question={q} examId={id} /><div style={{ marginTop: 20 }}><ActionForm action={adminAction} button="Remove question" confirm="Remove this question from future attempts? Existing attempts will be preserved. The exam will be unpublished."><Hidden name="op" value="deleteQuestion" /><Hidden name="id" value={q.id} /><Check name="confirm" label="I confirm removal from future attempts." /></ActionForm></div></details>)}<details className="details"><summary>＋ Add MCQ question</summary><QuestionEditor examId={id} /></details>{exam.archived && <ActionForm action={adminAction} button="Restore exam as draft"><Hidden name="op" value="restoreExam" /><Hidden name="id" value={id} /></ActionForm>}</>;
}
