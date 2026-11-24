import { guarded } from '../../../../lib/outreach/route-helpers';
import { leadsToCsv } from '../../../../lib/outreach/settings';
import { readState } from '../../../../lib/outreach/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Download every lead, its status and its email as CSV. */
export async function GET(request: Request) {
  return guarded(request, async () => {
    const { leads } = await readState();
    const date = new Date().toISOString().slice(0, 10);
    return new Response(`﻿${leadsToCsv(leads)}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="outreach-${date}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
