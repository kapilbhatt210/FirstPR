'use client';

export function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 mt-20 text-xs text-slate-400">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Privacy Note */}
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
              Privacy & Data Processing
            </h4>
            <p className="text-slate-400 leading-relaxed">
              FirstPR fetches public GitHub issue and repository metadata server-side using read-only GitHub endpoints.
              When AI enhancement is enabled, only bounded, sanitized issue text and safe file paths are sent to the configured provider (Gemma 4).
              No credentials or local files are sent, and FirstPR never writes to your repositories or creates PRs automatically.
            </p>
          </div>

          {/* Product Promise & Disclaimer */}
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
              Open-Source Readiness Tool
            </h4>
            <p className="text-slate-400 leading-relaxed">
              FirstPR is designed to lower the barrier for first-time open-source contributors.
              Commands and file suggestions are heuristics extracted from repository files and documentation.
              Always inspect and test changes in a local branch before opening a pull request.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">FirstPR</span>
            <span>•</span>
            <span>Deterministic Open-Source Contribution Engine</span>
          </div>
          <div>
            Built with Next.js, TypeScript & Gemma 4
          </div>
        </div>
      </div>
    </footer>
  );
}
