import { NextResponse } from 'next/server';
import { importFromSheet } from '../../../../lib/outreach/jobs';
import { guarded } from '../../../../lib/outreach/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Pull unprocessed rows from the Google Sheet into the local lead list. */
export async function POST(request: Request) {
  return guarded(request, async () => {
    const summary = await importFromSheet();
    const parts = [`${summary.added} new lead${summary.added === 1 ? '' : 's'} imported`];
    if (summary.duplicates) parts.push(`${summary.duplicates} duplicate email${summary.duplicates === 1 ? '' : 's'} skipped`);
    if (summary.invalid) parts.push(`${summary.invalid} row${summary.invalid === 1 ? '' : 's'} missing a name or valid email`);
    if (summary.suppressed) parts.push(`${summary.suppressed} on the do-not-contact list`);
    if (summary.alreadyHandled) parts.push(`${summary.alreadyHandled} already handled`);
    return NextResponse.json({ ok: true, summary, message: `${parts.join(', ')}.` });
  });
}
