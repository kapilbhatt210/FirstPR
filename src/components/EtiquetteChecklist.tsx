'use client';

import { useState } from 'react';

const ETIQUETTE_ITEMS = [
  {
    id: 'guidelines',
    label: 'Read repository contribution guidelines (CONTRIBUTING.md) and Code of Conduct',
    detail: 'Every project has unique rules for branching, commit conventions, and issue discussion.',
  },
  {
    id: 'status',
    label: 'Check issue assignment and recent comment activity',
    detail: 'Avoid duplicate work. If another contributor is already working on this, comment or pick another issue.',
  },
  {
    id: 'branch',
    label: 'Fork repository and create a focused topic branch',
    detail: 'Never push work directly to your fork’s main/master branch. Use a name like fix/issue-123.',
  },
  {
    id: 'tests',
    label: 'Write or update tests for your changes',
    detail: 'Maintainers prioritize PRs that prove functionality with automated unit or integration tests.',
  },
  {
    id: 'local-check',
    label: 'Run the project test suite and linter locally before pushing',
    detail: 'Ensure all tests pass and code style meets the project’s linters without introducing warnings.',
  },
  {
    id: 'description',
    label: 'Write a comprehensive PR description linking the issue',
    detail: 'Explain what changed, why the change was made, and how maintainers can test it.',
  },
  {
    id: 'patience',
    label: 'Be patient and respectful during code review',
    detail: 'Open-source maintainers are often volunteers. Welcome feedback and respond constructively to requested changes.',
  },
];

export function EtiquetteChecklist() {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const completedCount = Object.values(checkedItems).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / ETIQUETTE_ITEMS.length) * 100);

  return (
    <section aria-labelledby="etiquette-heading" className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 id="etiquette-heading" className="text-lg font-semibold text-white flex items-center gap-2">
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            First-Time Contributor Etiquette Checklist
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Follow standard open-source conventions to make your contribution welcome and seamless.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-slate-400">
            {completedCount} of {ETIQUETTE_ITEMS.length} checked
          </div>
          <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </div>

      <ul className="space-y-3" role="list">
        {ETIQUETTE_ITEMS.map((item) => {
          const isChecked = !!checkedItems[item.id];
          return (
            <li
              key={item.id}
              className={`p-3 rounded-lg border transition-colors flex items-start gap-3 cursor-pointer select-none ${
                isChecked
                  ? 'bg-emerald-950/20 border-emerald-900/60 text-slate-200'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:border-slate-700'
              }`}
              onClick={() => toggleItem(item.id)}
            >
              <input
                type="checkbox"
                id={`etiquette-${item.id}`}
                checked={isChecked}
                onChange={() => toggleItem(item.id)}
                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900 cursor-pointer"
                aria-describedby={`etiquette-${item.id}-desc`}
              />
              <div className="space-y-0.5">
                <label
                  htmlFor={`etiquette-${item.id}`}
                  className={`text-sm font-medium cursor-pointer ${
                    isChecked ? 'text-emerald-300 line-through decoration-emerald-600/70' : 'text-slate-200'
                  }`}
                >
                  {item.label}
                </label>
                <p id={`etiquette-${item.id}-desc`} className="text-xs text-slate-400 leading-normal">
                  {item.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
