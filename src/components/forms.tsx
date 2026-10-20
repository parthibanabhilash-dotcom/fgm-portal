'use client';
import { useActionState, useId, type ReactNode } from 'react';
import type { ActionState } from '@/app/actions';
export function ActionForm({ action, children, button = 'Save changes', className = '', confirm }: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>; children: ReactNode; button?: string; className?: string; confirm?: string;
}) {
  const [state, submit, pending] = useActionState(action, {});
  return <form action={submit} className={`form ${className}`} onSubmit={e => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
    <fieldset disabled={pending} className="form-fields">{children}</fieldset>
    {state.error && <p role="alert" className="notice error">{state.error}</p>}
    {state.success && <p role="status" className="notice success">{state.success}</p>}
    <button className="button" disabled={pending}>{pending ? 'Please wait…' : button}</button>
  </form>;
}
export function Field({ label, name, type = 'text', value, required = false, placeholder, min, max, hint }: {
  label: string; name: string; type?: string; value?: string | number; required?: boolean; placeholder?: string; min?: number; max?: number; hint?: string;
}) {
  const id = useId();
  return <div className="field"><label htmlFor={id}>{label}</label><input id={id} name={name} type={type} defaultValue={value} required={required} placeholder={placeholder} min={min} max={max} aria-describedby={hint ? `${id}-hint` : undefined} autoComplete={type === 'password' ? (name === 'currentPassword' ? 'current-password' : 'new-password') : undefined} />{hint && <small id={`${id}-hint`}>{hint}</small>}</div>;
}
export function TextArea({ label, name, value, required, rows = 4, hint }: { label: string; name: string; value?: string; required?: boolean; rows?: number; hint?: string }) {
  const id = useId(); return <div className="field"><label htmlFor={id}>{label}</label><textarea id={id} name={name} defaultValue={value} required={required} rows={rows} aria-describedby={hint ? `${id}-hint` : undefined} />{hint && <small id={`${id}-hint`}>{hint}</small>}</div>;
}
export function Check({ label, name, checked }: { label: string; name: string; checked?: boolean }) {
  return <label className="check"><input type="checkbox" name={name} defaultChecked={checked} />{label}</label>;
}
export function Hidden({ name, value }: { name: string; value: string }) { return <input type="hidden" name={name} value={value} />; }
