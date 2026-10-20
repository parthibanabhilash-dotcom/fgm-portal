export type Snapshot = {
  title: string; passPercentage: number; release: 'IMMEDIATE' | 'AFTER_CLOSE' | 'NEVER'; availableUntil: string | null;
  questions: { id: string; text: string; marks: number; choices: { id: string; text: string; correct: boolean }[] }[];
};
export function examMarks(snapshot: Snapshot, answers: { questionId: string; choiceId: string }[]) {
  const total = snapshot.questions.reduce((sum, q) => sum + q.marks, 0);
  if (total <= 0) throw new Error('Exam has no marks.');
  const earned = snapshot.questions.reduce((sum, q) => sum + (q.choices.some(c => c.correct && c.id === answers.find(a => a.questionId === q.id)?.choiceId) ? q.marks : 0), 0);
  return { earned, total };
}
export function grade(snapshot: Snapshot, answers: { questionId: string; choiceId: string }[]) {
  const { earned, total } = examMarks(snapshot, answers);
  const score = Math.round(earned / total * 10000) / 100;
  return { score, passed: earned * 100 >= snapshot.passPercentage * total };
}
export function mayReview(snapshot: Snapshot, submitted: boolean, now = new Date()) {
  return submitted && (snapshot.release === 'IMMEDIATE' || (snapshot.release === 'AFTER_CLOSE' && !!snapshot.availableUntil && new Date(snapshot.availableUntil) <= now));
}
export function safeQuestions(snapshot: Snapshot, review: boolean) {
  return snapshot.questions.map(q => ({ id: q.id, text: q.text, marks: q.marks,
    choices: q.choices.map(c => ({ id: c.id, text: c.text, ...(review ? { correct: c.correct } : {}) })) }));
}
export function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
