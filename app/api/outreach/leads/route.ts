import { NextResponse } from 'next/server';
import { isMockMode } from '../../../../lib/outreach/deps';
import { guarded } from '../../../../lib/outreach/route-helpers';
import { readState, sentToday } from '../../../../lib/outreach/store';
import type { LeadsResponse } from '../../../../types/outreach';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return guarded(request, async () => {
    const state = await readState();
    return NextResponse.json<LeadsResponse>({
      ok: true,
      leads: state.leads,
      sentToday: sentToday(state),
      dailySendCap: state.settings.dailySendCap,
      suppressedCount: state.suppression.length,
      mock: isMockMode(),
    });
  });
}
