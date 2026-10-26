'use client';

import { useState } from 'react';
import { parseGitHubIssueUrl } from '@/lib/github/url-parser';

export interface IssueFormProps {
  onSubmit: (issueUrl: string, enableAi: boolean) => Promise<void>;
  isLoading: boolean;
  serverError?: {
    code: string;
    message: string;
    details?: string;
  } | null;
}

const SAMPLE_ISSUES = [
  {
    name: 'vercel/next.js #50000',
    url: 'https://github.com/vercel/next.js/issues/50000',
    badge: 'App Router',
  },
  {
    name: 'expressjs/express #7560',
    url: 'https://github.com/expressjs/express/issues/7560',
    badge: 'Node.js',
  },
  {
    name: 'sindresorhus/is #220',
    url: 'https://github.com/sindresorhus/is/issues/220',
    badge: 'TypeScript',
  },
];

export function IssueForm({ onSubmit, isLoading, serverError }: IssueFormProps) {
  const [url, setUrl] = useState('');
  const [enableAi, setEnableAi] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const validateAndSubmit = async (targetUrl: string, targetAi: boolean) => {
    const trimmed = targetUrl.trim();
    if (!trimmed) {
      setClientError('Please enter a GitHub issue URL.');
      return;
    }

    const parsed = parseGitHubIssueUrl(trimmed);
    if (!parsed.success) {
      setClientError(parsed.error);
      return;
    }

    setClientError(null);
    await onSubmit(trimmed, targetAi);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    validateAndSubmit(url, enableAi);
  };

  const handleSelectSample = (sampleUrl: string) => {
    setUrl(sampleUrl);
    setClientError(null);
    validateAndSubmit(sampleUrl, enableAi);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 backdrop-blur-md shadow-2xl space-y-6"
      >
        <div className="space-y-2">
          <label
            htmlFor="issue-url-input"
            className="block text-sm font-semibold text-slate-200"
          >
            GitHub Issue URL
          </label>
          <div className="relative">
            <input
              id="issue-url-input"
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (clientError) setClientError(null);
              }}
              placeholder="https://github.com/owner/repository/issues/123"
              disabled={isLoading}
              aria-describedby={clientError ? 'url-error' : 'url-hint'}
              aria-invalid={!!clientError}
              className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 font-mono text-sm focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 focus-visible:outline-none transition-colors disabled:opacity-50"
            />
          </div>
          <p id="url-hint" className="text-xs text-slate-400">
            Paste any public GitHub repository issue URL to analyze the codebase and generate a contribution plan.
          </p>
        </div>

        {/* AI Enhancement Toggle */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-3">
          <input
            id="ai-toggle"
            type="checkbox"
            checked={enableAi}
            onChange={(e) => setEnableAi(e.target.checked)}
            disabled={isLoading}
            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900 cursor-pointer disabled:opacity-50"
            aria-describedby="ai-toggle-desc"
          />
          <div className="space-y-0.5">
            <label
              htmlFor="ai-toggle"
              className="text-xs sm:text-sm font-semibold text-slate-200 cursor-pointer flex items-center gap-2"
            >
              <span>Enable AI Enhancement (Gemma 4)</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/60">
                Optional
              </span>
            </label>
            <p id="ai-toggle-desc" className="text-xs text-slate-400 leading-relaxed">
              Synthesizes deeper context and technical risks with Gemma 4. If AI is unconfigured or unavailable, FirstPR automatically falls back to the deterministic baseline with zero loss of functionality.
            </p>
          </div>
        </div>

        {/* Client Error Display */}
        {clientError && (
          <div
            id="url-error"
            role="alert"
            className="p-3.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center gap-2.5 animate-in fade-in"
          >
            <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{clientError}</span>
          </div>
        )}

        {/* Server Error Display */}
        {serverError && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs space-y-1 animate-in fade-in"
          >
            <div className="flex items-center gap-2 font-semibold text-rose-100">
              <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Request Failed ({serverError.code})</span>
            </div>
            <p className="text-rose-200/90 leading-relaxed">{serverError.message}</p>
            {serverError.details && (
              <p className="text-[11px] font-mono text-rose-300/80 mt-1">{serverError.details}</p>
            )}
          </div>
        )}

        {/* Submit Action */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:outline-none"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Analyzing Issue & Repository...</span>
            </>
          ) : (
            <>
              <span>Generate Contribution Plan</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </form>

      {/* Sample Issues */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-slate-400">
        <span className="font-medium text-slate-500">Explore sample issues:</span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {SAMPLE_ISSUES.map((sample) => (
            <button
              key={sample.name}
              type="button"
              onClick={() => handleSelectSample(sample.url)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/80 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none disabled:opacity-50"
            >
              {sample.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
