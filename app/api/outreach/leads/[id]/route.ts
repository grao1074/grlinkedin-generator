import { NextResponse } from 'next/server';
import { readJson } from '../../../../../lib/http';
import { MAX_BODY, MAX_SUBJECT, stripMarkdown } from '../../../../../lib/outreach/email';
import { isBusy, retry, skipLead } from '../../../../../lib/outreach/jobs';
import { fail, guarded, str } from '../../../../../lib/outreach/route-helpers';
import { readState, updateLead } from '../../../../../lib/outreach/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Small actions on one lead. Body: {action, subject?, body?}
 *  save      - keep your edits (an approved email goes back to "drafted" so you re-approve the final text)
 *  approve   - mark ready to send
 *  unapprove - back to drafted
 *  skip      - leave this lead out
 *  do-not-contact - skip and never contact this email again
 *  retry     - pick up where a failed lead stopped
 */
export async function PATCH(request: Request, { params }: Ctx) {
  return guarded(request, async () => {
    const { id } = await params;
    const body = await readJson(request);
    const action = body.action;
    const lead = (await readState()).leads.find((l) => l.id === id);
    if (!lead) return fail('Lead not found.', 404);
    if (isBusy(id) || lead.status === 'sending') return fail('This lead is being worked on. Try again in a moment.', 409);
    if (lead.status === 'sent' && action !== 'do-not-contact') return fail('This email has already been sent.', 409);

    switch (action) {
      case 'save': {
        if (!lead.draft) return fail('There is no draft to edit.');
        const subject = str(body.subject, MAX_SUBJECT).replace(/[\r\n]+/g, ' ').trim();
        const text = stripMarkdown(str(body.body, MAX_BODY));
        if (!subject || !text) return fail('Subject and body cannot be empty.');
        const updated = await updateLead(id, (l) => {
          if (!l.draft) return;
          l.draft.subject = subject;
          l.draft.body = text;
          l.draft.edited = true;
          if (l.status === 'approved') l.status = 'drafted';
        });
        return NextResponse.json({ ok: true, lead: updated });
      }
      case 'approve': {
        if (!lead.draft?.subject || !lead.draft.body) return fail('Write or generate a draft first.');
        if (lead.status !== 'drafted') return fail('Only drafted emails can be approved.');
        return NextResponse.json({ ok: true, lead: await updateLead(id, { status: 'approved', error: undefined }) });
      }
      case 'unapprove': {
        if (lead.status !== 'approved') return fail('This email is not approved.');
        return NextResponse.json({ ok: true, lead: await updateLead(id, { status: 'drafted' }) });
      }
      case 'skip':
        return NextResponse.json({ ok: true, lead: await skipLead(id, false) });
      case 'do-not-contact':
        return NextResponse.json({ ok: true, lead: await skipLead(id, true) });
      case 'retry':
        if (!(await retry(id))) return fail('Could not restart this lead.', 409);
        return NextResponse.json({ ok: true });
      default:
        return fail('Unknown action.');
    }
  });
}
