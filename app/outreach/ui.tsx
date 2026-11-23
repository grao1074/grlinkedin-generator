'use client';

import type { ReactNode } from 'react';
import { ACTIVE_STATUSES, type LeadStatus } from '../../types/outreach';
import { STATUS_LABEL, STATUS_STYLE } from './client';

export function StatusBadge({ status }: { status: LeadStatus }) {
  const active = ACTIVE_STATUSES.includes(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[status]}`}>
      {active && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" aria-hidden />}
      {STATUS_LABEL[status]}
    </span>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  success: 'bg-green-600 hover:bg-green-700 text-white',
  secondary: 'bg-white border border-gray-300 hover:bg-gray-100 text-gray-800',
  danger: 'bg-white border border-red-300 hover:bg-red-50 text-red-700',
  ghost: 'text-gray-600 hover:bg-gray-100',
};

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  type = 'button',
  small,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  disabled?: boolean;
  type?: 'button' | 'submit';
  small?: boolean;
  title?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${small ? 'text-xs px-2.5 py-1.5' : 'text-sm px-4 py-2'} rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>{children}</section>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <p className="font-medium text-gray-800">{title}</p>
      {children && <div className="text-sm text-gray-500 mt-1 max-w-md mx-auto">{children}</div>}
    </div>
  );
}

/** A 0..1 match score as a small bar and percentage. */
export function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.8 ? 'bg-green-500' : score >= 0.5 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <span className="inline-flex items-center gap-2 text-xs text-gray-600" title="Match score: name 60%, company 40%">
      <span className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <span className={`block h-full ${color}`} style={{ width: `${pct}%` }} />
      </span>
      {pct}% match
    </span>
  );
}
