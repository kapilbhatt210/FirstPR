'use client';

import { useState } from 'react';
import { ContributionBriefing } from '@/lib/briefing/schema';
import { GitHubIssueContext } from '@/lib/github/types';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { IssueForm } from '@/components/IssueForm';
import { BriefingView } from '@/components/BriefingView';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [briefing, setBriefing] = useState<ContributionBriefing | null>(null);
  const [context, setContext] = useState<GitHubIssueContext | null>(null);
  const [aiMetadata, setAiMetadata] = useState<{
    enhanced: boolean;
    provider?: string;
    model?: string;
    error?: string;
  } | null>(null);
  const [serverError, setServerError] = useState<{
    code: string;
    message: string;
    details?: string;
  } | null>(null);

  const handleSubmit = async (issueUrl: string, enableAi: boolean) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const response = await fetch('/api/briefing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ issueUrl, enableAi }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setServerError({
          code: data.error?.code || 'REQUEST_FAILED',
          message: data.error?.message || 'Unable to generate contribution briefing.',
          details: data.error?.details,
        });
        return;
      }

      setBriefing(data.briefing);
      setContext(data.context);
      setAiMetadata(data.aiMetadata || null);

      // Scroll smoothly to the briefing view
      setTimeout(() => {
        const briefingElem = document.getElementById('briefing-results');
        if (briefingElem) {
          briefingElem.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'A network connection error occurred.';
      setServerError({
        code: 'NETWORK_ERROR',
        message: 'Could not connect to the FirstPR server. Please check your network and try again.',
        details: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setBriefing(null);
    setContext(null);
    setAiMetadata(null);
    setServerError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-12">
        {/* Hero Section */}
        <section aria-labelledby="hero-heading" className="text-center space-y-5 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/80">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Open-Source Contributor Toolkit
          </div>

          <h1
            id="hero-heading"
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight"
          >
            Paste an issue.{' '}
            <span className="text-emerald-400">Understand the work.</span>{' '}
            Make your first contribution.
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            FirstPR prepares first-time contributors with repository context, candidate files, verified workspace commands, next steps, and a ready-to-use pull request draft.
          </p>
        </section>

        {/* Input Form */}
        <section aria-label="Issue Analysis Form">
          <IssueForm
            onSubmit={handleSubmit}
            isLoading={isLoading}
            serverError={serverError}
          />
        </section>

        {/* Results Area or Empty State */}
        {briefing ? (
          <section id="briefing-results" aria-label="Generated Contribution Plan" className="pt-8 border-t border-slate-800/80 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Contribution Readiness Briefing
              </h2>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-md border border-slate-800 bg-slate-900/60 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
              >
                Analyze Another Issue
              </button>
            </div>

            <BriefingView
              briefing={briefing}
              context={context || undefined}
              aiMetadata={aiMetadata || undefined}
            />
          </section>
        ) : (
          /* Empty State / How it works */
          <section id="how-it-works" aria-labelledby="how-heading" className="pt-12 border-t border-slate-900 space-y-8">
            <div className="text-center space-y-2">
              <h2 id="how-heading" className="text-lg font-semibold text-white tracking-tight">
                How FirstPR Prepares Your First PR
              </h2>
              <p className="text-xs text-slate-400 max-w-lg mx-auto">
                No hallucinated paths, ungrounded shell commands, or automatic commits. Transparent guidance built for real repository standards.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <h3 className="text-sm font-semibold text-white">Repository Ingestion</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Fetches public issue metadata, candidate file trees, and contribution documentation server-side.
                </p>
              </div>

              <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <h3 className="text-sm font-semibold text-white">Candidate Grounding</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Identifies likely files to edit, guaranteeing every suggested path exists in the repository tree.
                </p>
              </div>

              <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-xs flex items-center justify-center">
                  3
                </div>
                <h3 className="text-sm font-semibold text-white">Command Provenance</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Extracts setup and test commands, attributing whether they were verified in docs or inferred from tree.
                </p>
              </div>

              <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-xs flex items-center justify-center">
                  4
                </div>
                <h3 className="text-sm font-semibold text-white">PR Draft Ready</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Prepares an actionable contribution plan and copyable draft pull request title and markdown description.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
