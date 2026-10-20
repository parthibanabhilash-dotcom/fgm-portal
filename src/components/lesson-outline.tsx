'use client';
import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ListVideo } from 'lucide-react';

export function LessonOutline({ children, completed, total }: { children: ReactNode; completed: number; total: number }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return <aside className="lesson-sidebar">
    <button className="outline-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
      <ListVideo size={22} aria-hidden="true" />
      <span>Course lessons<small>{completed} of {total} completed</small></span>
      <ChevronDown size={20} aria-hidden="true" style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
    </button>
    <div id={id} className={`outline-content ${expanded ? 'expanded' : ''}`}>{children}</div>
  </aside>;
}
