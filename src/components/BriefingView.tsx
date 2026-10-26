'use client';

import { ContributionBriefing, DifficultyLevel } from '@/lib/briefing/schema';
import { GitHubIssueContext } from '@/lib/github/types';
import { CommandCard } from './CommandCard';
import { PrDraftSection } from './PrDraftSection';
import { EtiquetteChecklist } from './EtiquetteChecklist';

export interface BriefingViewProps {
  briefing: ContributionBriefing;
  context?: GitHubIssueContext;
  aiMetadata?: {
    enhanced: boolean;
    provider?: string;
    model?: string;
    error?: string;
  };
}

function getDifficultyBadge(difficulty: DifficultyLevel) {
  switch (difficulty) {
    case 'beginner':
      return {
        label: 'Good First Issue (Beginner)',
        className: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
        dot: 'bg-emerald-400',
      };
    case 'intermediate':
      return {
        label: 'Intermediate Contribution',
        className: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
        dot: 'bg-amber-400',
      };
    case 'advanced':
      return {
        label: 'Advanced Scope',
        className: 'bg-rose-950/80 text-rose-300 border-rose-800/80',
        dot: 'bg-rose-400',
      };
    default:
      return {
        label: 'General Contribution',
        className: 'bg-slate-800 text-slate-300 border-slate-700',
        dot: 'bg-slate-400',
      };
  }
}

export function BriefingView({ briefing, context, aiMetadata }: BriefingViewProps) {
  const diffBadge = getDifficultyBadge(briefing.difficulty);
  const isClosed = briefing.issue.state === 'closed';
  const hasAssignees = briefing.issue.assignees && briefing.issue.assignees.length > 0;
  const isAiEnhanced = aiMetadata?.enhanced ?? false;

  return (
    <article aria-label="Contribution Briefing" className="space-y-8 animate-in fade-in duration-500">
      {/* 9. AI Enhancement Status Banner */}
      <section aria-label="AI Enhancement Status" className="rounded-xl border p-4 bg-slate-900/80 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${isAiEnhanced ? 'bg-purple-400 animate-pulse' : 'bg-emerald-400'}`}
              aria-hidden="true"
            />
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                Engine Status
              </span>
              <p className="text-sm font-medium text-slate-200">
                {isAiEnhanced
                  ? `AI-Enhanced via ${aiMetadata?.provider || 'Gemma 4'} (${aiMetadata?.model || 'gemma-4-26b-a4b-it'})`
                  : 'Deterministic Briefing Engine (Safeguarded Baseline)'}
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-400">
            {isAiEnhanced ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-950/60 text-purple-300 border border-purple-800/60">
                Repository evidence verified • AI insights advisory
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/80">
                100% deterministic • Zero hallucination
              </span>
            )}
          </div>
        </div>

        {aiMetadata?.error && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-amber-300/90 flex items-center gap-2">
            <span aria-hidden="true">⚠️</span>
            <span>AI enhancement fallback: {aiMetadata.error}. Deterministic baseline preserved.</span>
          </div>
        )}
      </section>

      {/* 6. Critical Warnings (Closed / Assigned Issues) */}
      {(isClosed || hasAssignees) && (
        <section aria-label="Issue Warnings" className="space-y-3">
          {isClosed && (
            <div
              role="alert"
              className="p-4 rounded-xl border border-rose-800/80 bg-rose-950/50 text-rose-200 flex items-start gap-3"
            >
              <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-rose-100">Closed Issue Warning</h4>
                <p className="text-xs text-rose-300/90 mt-1 leading-relaxed">
                  This issue is marked as <strong>closed</strong> on GitHub. It may have already been resolved, rejected, or merged. Reach out to maintainers before submitting work.
                </p>
              </div>
            </div>
          )}

          {hasAssignees && (
            <div
              role="alert"
              className="p-4 rounded-xl border border-amber-800/80 bg-amber-950/50 text-amber-200 flex items-start gap-3"
            >
              <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-amber-100">Active Assignee Warning</h4>
                <p className="text-xs text-amber-300/90 mt-1 leading-relaxed">
                  This issue is already assigned to{' '}
                  <strong>{briefing.issue.assignees.map((a) => `@${a}`).join(', ')}</strong>.
                  Please comment on the issue or coordinate with the assignee before writing code to prevent duplicated effort.
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 1. Issue Header & Summary */}
      <section aria-labelledby="issue-overview-heading" className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <a
              href={`https://github.com/${briefing.repository.fullName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-slate-300 hover:text-emerald-400 underline decoration-slate-700 transition-colors"
            >
              {briefing.repository.fullName}
            </a>
            <span>•</span>
            <span className="font-mono">
              branch: <code className="text-slate-300">{briefing.repository.defaultBranch || 'default'}</code>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isClosed
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
              }`}
            >
              {isClosed ? 'Closed' : 'Open'}
            </span>
            <a
              href={briefing.issue.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <span>GitHub #{briefing.issue.issueNumber}</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        <div>
          <h2 id="issue-overview-heading" className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {briefing.issue.title}
          </h2>
          <p className="mt-3 text-slate-300 leading-relaxed text-sm sm:text-base">
            {briefing.summary}
          </p>
        </div>
      </section>

      {/* 2. Difficulty & Time Estimate */}
      <section aria-labelledby="difficulty-heading" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Assessed Difficulty
          </span>
          <div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${diffBadge.className}`}>
              <span className={`w-2 h-2 rounded-full ${diffBadge.dot}`} />
              {diffBadge.label}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Estimated Time Range
          </span>
          <p className="text-lg font-bold text-white">
            {briefing.estimatedTimeMinutes.minMinutes}–{briefing.estimatedTimeMinutes.maxMinutes} mins
          </p>
          <p className="text-[11px] text-slate-400">
            Approximate heuristic for a first-time contributor.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-2 md:col-span-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Difficulty Rationale
          </span>
          <p className="text-xs text-slate-300 leading-relaxed">
            {briefing.difficultyRationale}
          </p>
        </div>
      </section>

      {/* 3. Candidate Files */}
      <section aria-labelledby="candidate-files-heading" className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 id="candidate-files-heading" className="text-lg font-semibold text-white">
              Candidate Files to Inspect
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Grounded exclusively in the repository file tree.
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/60">
            {briefing.candidateFiles.length} file{briefing.candidateFiles.length === 1 ? '' : 's'} identified
          </span>
        </div>

        {briefing.candidateFiles.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No specific candidate files identified in tree.</p>
        ) : (
          <ul className="space-y-3" role="list">
            {briefing.candidateFiles.map((file, idx) => (
              <li
                key={`${file.path}-${idx}`}
                className="p-4 rounded-lg border border-slate-800/80 bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs sm:text-sm text-emerald-300 font-semibold select-all">
                      {file.path}
                    </span>
                    <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {file.confidence} confidence
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {file.reason}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Setup & Test Commands */}
      <section aria-labelledby="commands-heading" className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h3 id="commands-heading" className="text-lg font-semibold text-white">
            Workspace Commands
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Setup and testing commands extracted from documentation or repository manifests.
          </p>
        </div>

        {/* Unexecuted Commands Warning Banner */}
        <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
          <span className="text-amber-400 font-bold" aria-hidden="true">
            ⚠️
          </span>
          <span>
            <strong>Safety Notice:</strong> Commands shown below have <em>not</em> been executed by FirstPR. Always review shell commands carefully before executing them in your local terminal.
          </span>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Setup & Installation Commands
          </h4>
          {briefing.setupCommands.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No specific setup commands identified.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {briefing.setupCommands.map((cmd, i) => (
                <CommandCard key={`setup-${i}`} command={cmd} index={i} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Test Execution Commands
          </h4>
          {briefing.testCommands.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No specific test commands identified.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {briefing.testCommands.map((cmd, i) => (
                <CommandCard key={`test-${i}`} command={cmd} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. Ordered Next Steps */}
      <section aria-labelledby="next-steps-heading" className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="border-b border-slate-800 pb-4">
          <h3 id="next-steps-heading" className="text-lg font-semibold text-white">
            Step-by-Step Contribution Plan
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Recommended sequence for setting up, inspecting, making changes, and testing.
          </p>
        </div>

        <ol className="space-y-3" role="list">
          {briefing.nextSteps.map((step, idx) => (
            <li
              key={`step-${idx}`}
              className="p-3.5 rounded-lg border border-slate-800/80 bg-slate-950/40 flex items-start gap-3.5"
            >
              <span className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <p className="text-sm text-slate-300 leading-relaxed">
                {step}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* 6. Risks, Limitations & Caveats */}
      {(briefing.warnings.length > 0 || briefing.limitations.length > 0) && (
        <section aria-labelledby="caveats-heading" className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="border-b border-slate-800 pb-4">
            <h3 id="caveats-heading" className="text-lg font-semibold text-white">
              Risks & Known Limitations
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Contextual caveats and limitations noted during repository analysis.
            </p>
          </div>

          {briefing.warnings.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Warnings & Advisories
              </span>
              <ul className="space-y-2 text-xs text-slate-300">
                {briefing.warnings.map((warn, i) => (
                  <li key={`warn-${i}`} className="p-2.5 rounded bg-amber-950/30 border border-amber-900/40 flex items-start gap-2">
                    <span className="text-amber-400 shrink-0">⚠️</span>
                    <span>{warn}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {briefing.limitations.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Analysis Limitations
              </span>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-400 leading-relaxed">
                {briefing.limitations.map((lim, i) => (
                  <li key={`lim-${i}`}>{lim}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* 7. Draft PR Title & Description */}
      <PrDraftSection briefing={briefing} context={context} />

      {/* 8. Contributor Etiquette Checklist */}
      <EtiquetteChecklist />

      {/* Timestamp */}
      <div className="text-center text-xs text-slate-500 pt-4">
        Briefing generated at {new Date(briefing.generatedAt).toLocaleString()}
      </div>
    </article>
  );
}
