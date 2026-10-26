'use client';

import { CommandItem, CommandSourceStatus } from '@/lib/briefing/schema';
import { CopyButton } from './CopyButton';

interface CommandCardProps {
  command: CommandItem;
  index?: number;
}

function getProvenanceBadge(status: CommandSourceStatus) {
  switch (status) {
    case 'verified_in_docs':
      return {
        label: 'Verified in Docs',
        className: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
        dotColor: 'bg-emerald-400',
        title: 'Explicitly found in repository documentation (README or CONTRIBUTING).',
      };
    case 'inferred_from_tree':
      return {
        label: 'Inferred from Files',
        className: 'bg-sky-950/80 text-sky-300 border-sky-800/80',
        dotColor: 'bg-sky-400',
        title: 'Deduced from repository manifests or configuration files.',
      };
    case 'standard_fallback':
    default:
      return {
        label: 'Standard Fallback (Unverified)',
        className: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
        dotColor: 'bg-amber-400',
        title: 'Standard generic convention; not verified in repository files.',
      };
  }
}

export function CommandCard({ command }: CommandCardProps) {
  const badge = getProvenanceBadge(command.verificationStatus);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.className}`}
            title={badge.title}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
            {badge.label}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            via {command.source}
          </span>
        </div>
        <CopyButton textToCopy={command.command} label="Copy command" ariaLabel={`Copy command ${command.command}`} />
      </div>

      <div className="bg-slate-950 rounded-md p-3 border border-slate-800/80 overflow-x-auto">
        <code className="text-sm font-mono text-emerald-300 select-all whitespace-pre">
          {command.command}
        </code>
      </div>

      {command.description && (
        <p className="text-xs text-slate-400 leading-relaxed">
          {command.description}
        </p>
      )}
    </div>
  );
}
