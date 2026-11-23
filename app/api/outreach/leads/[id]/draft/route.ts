import { NextResponse } from 'next/server';
import { readJson } from '../../../../../../lib/http';
import { startDraft } from '../../../../../../lib/outreach/jobs';
import { fail, guarded, str } from '../../../../../../lib/outreach/route-helpers';
import { readState } from '../../../../../../lib/outreach/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Write (or rewrite) the email. Body: {note?} e.g. "shorter" or "mention their pilot". */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(request, async () => {
    const { id } = await params;
    const body = await readJson(request);
    const lead = (await readState()).leads.find((l) => l.id === id);
    if (!lead) return fail('Lead not found.', 404);
    if (!lead.profile) return fail('Find the LinkedIn profile first.');
    if (['sending', 'sent'].includes(lead.status)) return fail('This email has already gone out.', 409);
    if (!startDraft(id, str(body.note, 300))) return fail('This lead is already being worked on.', 409);
    return NextResponse.json({ ok: true });
  });
}
