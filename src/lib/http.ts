import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function api(work: () => Promise<unknown>) {
  try { return NextResponse.json(await work(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues.map(i => i.message).join('; ') }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: 'Unable to complete this request. Please try again.' }, { status: 500 });
  }
}
