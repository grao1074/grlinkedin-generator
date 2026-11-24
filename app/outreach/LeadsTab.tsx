'use client';

import { useMemo, useState } from 'react';
import type { Lead, LeadStatus } from '../../types/outreach';
import { STATUS_LABEL } from './client';
import { Button, Card, Empty, StatusBadge } from './ui';

type Filter = 'all' | LeadStatus;

const FILTER_ORDER: LeadStatus[] = ['new', 'needs-match', 'drafted', 'approved', 'sent', 'failed', 'skipped'];

/** Upper bound on Apify runs per new lead: person search, profile, company search, company. */
const RUNS_PER_LEAD = 4;

export function LeadsTab({
  leads,
  busy,
  onImport,
  onProcessAllNew,
  onProcessOne,
  onOpen,
}: {
  leads: Lead[];
  busy: boolean;
  onImport: () => void;
  onProcessAllNew: () => void;
  onProcessOne: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const c: Partial<Record<LeadStatus, number>> = {};
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads
      .filter((l) => filter === 'all' || l.status === filter)
      .filter((l) => !q || `${l.firstName} ${l.lastName} ${l.company} ${l.email}`.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [leads, filter, query]);

  const newCount = counts.new ?? 0;

  const processAll = () => {
    const runs = newCount * RUNS_PER_LEAD;
    if (window.confirm(`Process ${newCount} new lead${newCount === 1 ? '' : 's'}?\n\nThis uses up to ${runs} Apify runs (fewer when profiles are cached).`)) {
      onProcessAllNew();
    }
  };

  return (
    <Card>
      <div className="p-4 sm:p-6 border-b border-gray-200 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onImport} disabled={busy}>
            Import from sheet
          </Button>
          <Button onClick={processAll} disabled={busy || newCount === 0} title={`Up to ${newCount * RUNS_PER_LEAD} Apify runs`}>
            Process {newCount} new
            {newCount > 0 && <span className="text-gray-500 font-normal"> (≤ {newCount * RUNS_PER_LEAD} Apify runs)</span>}
          </Button>
          <a
            href="/api/outreach/export"
            className="text-sm px-4 py-2 rounded-lg font-medium bg-white border border-gray-300 hover:bg-gray-100 text-gray-800"
          >
            Export CSV
          </a>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, company, email"
          aria-label="Search leads"
          className="w-full lg:w-64 text-sm px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <div className="px-4 sm:px-6 py-3 flex flex-wrap gap-2 border-b border-gray-100" role="tablist" aria-label="Filter by status">
        {(['all', ...FILTER_ORDER] as Filter[]).map((f) => {
          const n = f === 'all' ? leads.length : (counts[f] ?? 0);
          if (f !== 'all' && n === 0) return null;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1 rounded-full border ${
                filter === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? 'All' : STATUS_LABEL[f]} · {n}
            </button>
          );
        })}
      </div>

      {leads.length === 0 ? (
        <Empty title="No leads yet">
          Press <strong>Import from sheet</strong> to pull rows from your Google Sheet. Rows need First Name, Last Name,
          Company and Email columns.
        </Empty>
      ) : shown.length === 0 ? (
        <Empty title="Nothing matches this filter" />
      ) : (
        <>
          {/* Table on wide screens */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Company</th>
                  <th className="px-3 py-3 font-medium">Email</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <div className="font-medium text-gray-900">
                        {l.firstName} {l.lastName}
                      </div>
                      {l.profile?.headline && <div className="text-xs text-gray-500 truncate max-w-xs">{l.profile.headline}</div>}
                    </td>
                    <td className="px-3 py-3 text-gray-700">{l.company}</td>
                    <td className="px-3 py-3 text-gray-600 break-all">{l.email}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={l.status} />
                      {l.error && <div className="text-xs text-red-600 mt-1 max-w-xs">{l.error}</div>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <LeadAction lead={l} busy={busy} onProcessOne={onProcessOne} onOpen={onOpen} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards on phones */}
          <ul className="md:hidden divide-y divide-gray-100">
            {shown.map((l) => (
              <li key={l.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">
                      {l.firstName} {l.lastName}
                    </p>
                    <p className="text-sm text-gray-600">{l.company}</p>
                    <p className="text-xs text-gray-500 break-all">{l.email}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </div>
                {l.error && <p className="text-xs text-red-600">{l.error}</p>}
                <LeadAction lead={l} busy={busy} onProcessOne={onProcessOne} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function LeadAction({
  lead,
  busy,
  onProcessOne,
  onOpen,
}: {
  lead: Lead;
  busy: boolean;
  onProcessOne: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  switch (lead.status) {
    case 'new':
      return (
        <Button small onClick={() => onProcessOne(lead.id)} disabled={busy}>
          Find on LinkedIn
        </Button>
      );
    case 'needs-match':
      return (
        <Button small variant="primary" onClick={() => onOpen(lead.id)}>
          Pick match
        </Button>
      );
    case 'drafted':
    case 'enriched':
    case 'failed':
      return (
        <Button small variant="primary" onClick={() => onOpen(lead.id)}>
          {lead.status === 'failed' ? 'See problem' : 'Review'}
        </Button>
      );
    case 'approved':
    case 'sent':
    case 'skipped':
      return (
        <Button small variant="ghost" onClick={() => onOpen(lead.id)}>
          Open
        </Button>
      );
    default:
      return <span className="text-xs text-gray-400">Working…</span>;
  }
}
