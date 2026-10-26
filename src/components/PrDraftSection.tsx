'use client';

import { ContributionBriefing } from '@/lib/briefing/schema';
import { generatePrDraft } from '@/lib/briefing/pr-draft';
import { GitHubIssueContext } from '@/lib/github/types';
import { CopyButton } from './CopyButton';

interface PrDraftSectionProps {
  briefing: ContributionBriefing;
  context?: GitHubIssueContext;
}

export function PrDraftSection({ briefing, context }: PrDraftSectionProps) {
  const draft = generatePrDraft(briefing, context);

  return (
    <section aria-labelledby="pr-draft-heading" className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <h3 id="pr-draft-heading" className="text-lg font-semibold text-white flex items-center gap-2">
            <svg
              className="w-5 h-5 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
              />
            </svg>
            Draft Pull Request
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Pre-structured title and description ready to paste when you open your PR.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700/80">
          Manual Copy & Paste
        </div>
      </div>

      {/* PR Title */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="pr-title-field" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Suggested PR Title
          </label>
          <CopyButton textToCopy={draft.title} label="Copy title" ariaLabel="Copy PR title" />
        </div>
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-sm text-slate-200 select-all overflow-x-auto">
          <span id="pr-title-field">{draft.title}</span>
        </div>
      </div>

      {/* PR Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="pr-desc-field" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Markdown Description
          </label>
          <CopyButton textToCopy={draft.description} label="Copy description" ariaLabel="Copy PR description" />
        </div>
        <pre
          id="pr-desc-field"
          className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto select-all"
        >
          {draft.description}
        </pre>
      </div>

      {/* Disclaimer */}
      <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800/80 text-xs text-slate-400 flex items-start gap-2">
        <span className="text-amber-400 font-semibold" aria-hidden="true">
          ℹ️
        </span>
        <span>
          <strong>Important:</strong> FirstPR does not submit pull requests to GitHub or modify any remote repositories.
          Always check if the project has a specific pull request template (in <code className="text-slate-300">.github/PULL_REQUEST_TEMPLATE.md</code>) before submitting.
        </span>
      </div>
    </section>
  );
}
