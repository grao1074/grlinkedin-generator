'use client';

import { useEffect, useMemo, useState } from 'react';
import { composeBody } from '../../lib/outreach/email';
import type { Lead, Settings } from '../../types/outreach';
import { CopyButton } from '../components/CopyButton';
import { needsAttention } from './client';
import { Button, Card, Empty, ScoreBar, StatusBadge } from './ui';

export interface ReviewActions {
  chooseMatch: (id: string, url: string) => Promise<boolean>;
  redraft: (id: string, note?: string) => Promise<boolean>;
  action: (id: string, action: string, extra?: Record<string, unknown>) => Promise<boolean>;
  goToSettings: () => void;
}

export function ReviewTab({
  leads,
  selectedId,
  onSelect,
  settings,
  actions,
}: {
  leads: Lead[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  settings: Settings | null;
  actions: ReviewActions;
}) {
  const queue = useMemo(() => {
    const order: Record<string, number> = { 'needs-match': 0, failed: 1, enriched: 2, drafted: 3 };
    return leads.filter(needsAttention).sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.createdAt.localeCompare(b.createdAt));
  }, [leads]);

  const selected = leads.find((l) => l.id === selectedId) ?? queue[0] ?? null;
  const list = selected && !queue.some((l) => l.id === selected.id) ? [selected, ...queue] : queue;

  if (!selected) {
    return (
      <Card>
        <Empty title="Nothing to review">
          Leads appear here when they need you: picking the right LinkedIn profile, or checking a draft before it is
          approved.
        </Empty>
      </Card>
    );
  }

  const index = queue.findIndex((l) => l.id === selected.id);
  const next = index >= 0 ? queue[index + 1] ?? queue[index - 1] : queue[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">
      <Card className="lg:sticky lg:top-4">
        <h2 className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Waiting for you · {queue.length}
        </h2>
        <ul className="max-h-[30vh] lg:max-h-[70vh] overflow-y-auto pb-2">
          {list.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => onSelect(l.id)}
                aria-current={l.id === selected.id ? 'true' : undefined}
                className={`w-full text-left px-4 py-2.5 border-l-4 ${
                  l.id === selected.id ? 'bg-blue-50 border-blue-600' : 'border-transparent hover:bg-gray-50'
                }`}
              >
                <span className="block text-sm font-medium text-gray-900 truncate">
                  {l.firstName} {l.lastName}
                </span>
                <span className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 truncate">{l.company}</span>
                  <StatusBadge status={l.status} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <LeadDetail
        key={selected.id}
        lead={selected}
        settings={settings}
        actions={actions}
        onDone={() => next && next.id !== selected.id && onSelect(next.id)}
      />
    </div>
  );
}

function LeadDetail({
  lead,
  settings,
  actions,
  onDone,
}: {
  lead: Lead;
  settings: Settings | null;
  actions: ReviewActions;
  onDone: () => void;
}) {
  const settingsProblem = lead.error?.startsWith('Fill in Settings');
  return (
    <div className="space-y-4 min-w-0">
      <Card className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-gray-900">
              {lead.firstName} {lead.lastName}
            </h2>
            <p className="text-sm text-gray-600">
              {lead.company} · <span className="break-all">{lead.email}</span>
            </p>
            {lead.profileUrl && (
              <a href={lead.profileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 hover:underline break-all">
                {lead.profileUrl} ↗
              </a>
            )}
          </div>
          <StatusBadge status={lead.status} />
        </div>
        {lead.error && (
          <div role="alert" className="mt-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex flex-wrap items-center gap-3 justify-between">
            <span>{lead.error}</span>
            {settingsProblem && (
              <Button small onClick={actions.goToSettings}>
                Open Settings
              </Button>
            )}
          </div>
        )}
      </Card>

      {(lead.status === 'needs-match' || (lead.status === 'failed' && !lead.profile)) && (
        <MatchPicker lead={lead} actions={actions} />
      )}

      {lead.status === 'failed' && (
        <Card className="p-4 sm:p-6 flex flex-wrap gap-2 items-center justify-between">
          <p className="text-sm text-gray-700">Try this lead again from where it stopped.</p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => actions.action(lead.id, 'retry')}>
              Retry
            </Button>
            <Button variant="danger" onClick={() => actions.action(lead.id, 'skip').then((ok) => ok && onDone())}>
              Skip lead
            </Button>
          </div>
        </Card>
      )}

      {lead.status === 'enriched' && !lead.draft && (
        <Card className="p-4 sm:p-6 flex flex-wrap gap-3 items-center justify-between">
          <p className="text-sm text-gray-700">Profile details are ready. Write the email when your Settings are filled in.</p>
          <Button variant="primary" onClick={() => actions.redraft(lead.id)}>
            Write draft
          </Button>
        </Card>
      )}

      {['searching', 'enriching', 'drafting', 'sending'].includes(lead.status) && (
        <Card className="p-6 text-sm text-gray-600 flex items-center gap-3">
          <span className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" aria-hidden />
          Working on it. This page updates by itself.
        </Card>
      )}

      {lead.draft && settings && <DraftEditor lead={lead} settings={settings} actions={actions} onDone={onDone} />}

      {(lead.profile || lead.companyInfo) && <ResearchCards lead={lead} />}
    </div>
  );
}

function MatchPicker({ lead, actions }: { lead: Lead; actions: ReviewActions }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const choose = async (u: string) => {
    setBusy(true);
    await actions.chooseMatch(lead.id, u);
    setBusy(false);
  };

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">Which one is {lead.firstName}?</h3>
        <p className="text-sm text-gray-600">
          No result was a clear match, so nothing was picked for you. Open a profile to check, then choose.
        </p>
      </div>

      {lead.candidates.length > 0 ? (
        <ul className="space-y-2">
          {lead.candidates.map((c) => (
            <li key={c.url} className="border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{c.name}</p>
                {c.headline && <p className="text-sm text-gray-700">{c.headline}</p>}
                {c.snippet && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.snippet}</p>}
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <ScoreBar score={c.score} />
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 hover:underline">
                    Open on LinkedIn ↗
                  </a>
                </div>
              </div>
              <Button variant="primary" small disabled={busy} onClick={() => choose(c.url)}>
                This is them
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">Search found no LinkedIn profiles.</p>
      )}

      <form
        className="flex flex-col sm:flex-row gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) choose(url.trim());
        }}
      >
        <label className="sr-only" htmlFor={`url-${lead.id}`}>
          LinkedIn profile URL
        </label>
        <input
          id={`url-${lead.id}`}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Or paste their profile URL: https://www.linkedin.com/in/…"
          className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-lg"
        />
        <Button type="submit" disabled={busy || !url.trim()}>
          Use this URL
        </Button>
      </form>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
        <Button variant="ghost" small onClick={() => actions.action(lead.id, 'skip')}>
          Skip this lead
        </Button>
        <Button variant="ghost" small onClick={() => actions.action(lead.id, 'do-not-contact')}>
          Never contact this email
        </Button>
      </div>
    </Card>
  );
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function DraftEditor({
  lead,
  settings,
  actions,
  onDone,
}: {
  lead: Lead;
  settings: Settings;
  actions: ReviewActions;
  onDone: () => void;
}) {
  const draft = lead.draft!;
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [note, setNote] = useState('');
  const [showFinal, setShowFinal] = useState(false);
  const [busy, setBusy] = useState(false);

  // A new AI draft replaces local text; polling the same draft does not.
  useEffect(() => {
    setSubject(draft.subject);
    setBody(draft.body);
  }, [draft.generatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = subject !== draft.subject || body !== draft.body;
  const locked = ['sent', 'sending', 'skipped'].includes(lead.status);
  const words = wordCount(body);

  const run = async (fn: () => Promise<boolean>, advance = false) => {
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    if (ok && advance) onDone();
    return ok;
  };

  const save = () => actions.action(lead.id, 'save', { subject, body });
  const approve = () =>
    run(async () => {
      if (dirty && !(await save())) return false;
      return actions.action(lead.id, 'approve');
    }, true);

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900">Email draft</h3>
        <span className="text-xs text-gray-500">
          {draft.edited ? 'Edited by you' : 'Written by AI'} · {words} words
          {words > 160 && <span className="text-amber-700"> · long for a first email</span>}
        </span>
      </div>

      <div>
        <label htmlFor={`subject-${lead.id}`} className="block text-xs font-medium text-gray-600 mb-1">
          Subject
        </label>
        <input
          id={`subject-${lead.id}`}
          value={subject}
          disabled={locked}
          maxLength={120}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
        />
      </div>
      <div>
        <label htmlFor={`body-${lead.id}`} className="block text-xs font-medium text-gray-600 mb-1">
          Body
        </label>
        <textarea
          id={`body-${lead.id}`}
          value={body}
          disabled={locked}
          rows={11}
          maxLength={2500}
          onChange={(e) => setBody(e.target.value)}
          className="w-full text-sm leading-relaxed px-3 py-2 border border-gray-300 rounded-lg font-[inherit] disabled:bg-gray-50"
        />
      </div>

      <FactsUsed lead={lead} />

      <div>
        <button type="button" onClick={() => setShowFinal((v) => !v)} className="text-sm text-blue-700 hover:underline" aria-expanded={showFinal}>
          {showFinal ? 'Hide' : 'Show'} exactly what will be sent
        </button>
        {showFinal && (
          <div className="mt-2 border border-gray-200 rounded-lg bg-gray-50 p-3 text-sm">
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="text-xs text-gray-600 space-y-0.5">
                <p>
                  <strong>To:</strong> {lead.email}
                </p>
                <p>
                  <strong>From:</strong> {settings.senderName || '(your name)'} {settings.senderEmail && `<${settings.senderEmail}>`}
                </p>
                {settings.replyTo && (
                  <p>
                    <strong>Reply-to:</strong> {settings.replyTo}
                  </p>
                )}
                <p>
                  <strong>Subject:</strong> {subject}
                </p>
              </div>
              <CopyButton text={`${subject}\n\n${composeBody({ body }, settings)}`} />
            </div>
            <pre className="whitespace-pre-wrap font-[inherit] text-gray-800">{composeBody({ body }, settings)}</pre>
          </div>
        )}
      </div>

      {!locked && (
        <>
          <div className="flex flex-wrap gap-2">
            {lead.status === 'approved' ? (
              <Button variant="secondary" disabled={busy} onClick={() => run(() => actions.action(lead.id, 'unapprove'))}>
                Move back to draft
              </Button>
            ) : (
              <Button variant="success" disabled={busy || !subject.trim() || !body.trim()} onClick={approve}>
                {dirty ? 'Save and approve' : 'Approve'}
              </Button>
            )}
            <Button disabled={busy || !dirty} onClick={() => run(save)}>
              Save edits
            </Button>
            {dirty && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setSubject(draft.subject);
                  setBody(draft.body);
                }}
              >
                Undo changes
              </Button>
            )}
          </div>

          <form
            className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-100"
            onSubmit={(e) => {
              e.preventDefault();
              if (dirty && !window.confirm('Rewriting replaces your edits. Continue?')) return;
              void run(() => actions.redraft(lead.id, note)).then((ok) => ok && setNote(''));
            }}
          >
            <label className="sr-only" htmlFor={`note-${lead.id}`}>
              Instruction for the rewrite
            </label>
            <input
              id={`note-${lead.id}`}
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder='Optional note, e.g. "shorter" or "mention their screening pilot"'
              className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-lg"
            />
            <Button type="submit" disabled={busy}>
              Rewrite with AI
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" small disabled={busy} onClick={() => run(() => actions.action(lead.id, 'skip'), true)}>
              Skip this lead
            </Button>
            <Button variant="ghost" small disabled={busy} onClick={() => run(() => actions.action(lead.id, 'do-not-contact'), true)}>
              Never contact this email
            </Button>
          </div>
        </>
      )}
      {lead.status === 'sent' && lead.sentAt && (
        <p className="text-sm text-green-700">Sent {new Date(lead.sentAt).toLocaleString()}.</p>
      )}
    </Card>
  );
}

function FactsUsed({ lead }: { lead: Lead }) {
  const facts = lead.draft?.factsUsed ?? [];
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <h4 className="text-sm font-semibold text-amber-900">Check these facts before approving</h4>
      {facts.length ? (
        <ul className="mt-2 space-y-1.5">
          {facts.map((f, i) => (
            <li key={i} className="text-sm text-amber-900">
              {f.fact}
              {f.source && <span className="ml-2 text-xs font-mono text-amber-700">from {f.source}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-amber-900 mt-1">
          The AI listed no facts about this person. Read the opening line carefully: it should not claim anything
          specific.
        </p>
      )}
      <p className="text-xs text-amber-700 mt-2">The source fields are in the research cards below and on their LinkedIn profile.</p>
    </div>
  );
}

function ResearchCards({ lead }: { lead: Lead }) {
  const p = lead.profile;
  const c = lead.companyInfo;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {p && (
        <Card className="p-4 sm:p-6 text-sm space-y-3">
          <h3 className="font-semibold text-gray-900">Profile</h3>
          {p.headline && <p className="text-gray-800">{p.headline}</p>}
          {p.location && <p className="text-xs text-gray-500">{p.location}</p>}
          {p.about && (
            <details>
              <summary className="cursor-pointer text-xs font-medium text-gray-600">About</summary>
              <p className="mt-1 text-gray-700 whitespace-pre-line">{p.about}</p>
            </details>
          )}
          {p.experience.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-600 mb-1">Experience</h4>
              <ul className="space-y-2">
                {p.experience.map((e, i) => (
                  <li key={i}>
                    <p className="text-gray-900">
                      <span className="text-xs font-mono text-gray-400 mr-1">[{i}]</span>
                      {e.title} · {e.company} {e.isCurrent && <span className="text-xs text-green-700">(current)</span>}
                    </p>
                    {e.duration && <p className="text-xs text-gray-500">{e.duration}</p>}
                    {e.description && <p className="text-xs text-gray-600 mt-0.5 line-clamp-3">{e.description}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.education.length > 0 && (
            <p className="text-xs text-gray-600">
              <span className="font-medium">Education:</span> {p.education.map((e) => [e.degree, e.school].filter(Boolean).join(', ')).join('; ')}
            </p>
          )}
        </Card>
      )}
      {c ? (
        <Card className="p-4 sm:p-6 text-sm space-y-2">
          <h3 className="font-semibold text-gray-900">Company</h3>
          <p className="text-gray-900">{c.name}</p>
          <p className="text-xs text-gray-500">
            {[c.industries.join(', '), c.headquarters, c.employeeCount ? `${c.employeeCount} on LinkedIn` : ''].filter(Boolean).join(' · ')}
          </p>
          {c.description && <p className="text-gray-700 line-clamp-6">{c.description}</p>}
          {c.specialties.length > 0 && <p className="text-xs text-gray-600">Specialties: {c.specialties.join(', ')}</p>}
          <div className="flex gap-3 text-xs">
            {c.website && (
              <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                Website ↗
              </a>
            )}
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
              LinkedIn page ↗
            </a>
          </div>
        </Card>
      ) : (
        p && (
          <Card className="p-4 sm:p-6 text-sm text-gray-500">
            No company page was found, so the draft uses only the profile.
          </Card>
        )
      )}
    </div>
  );
}
