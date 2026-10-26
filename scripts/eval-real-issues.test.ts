import { describe, it, expect } from 'vitest';
import { createBriefingFromUrl } from '../src/lib/briefing/service';

export const EVAL_REAL_ISSUES = [
  {
    category: '1. Documentation / README issue',
    url: 'https://github.com/expressjs/express/issues/4620',
    expectedRepo: 'expressjs/express',
    expectedIssueNumber: 4620,
    checkType: 'docs',
  },
  {
    category: '2. Simple bug report',
    url: 'https://github.com/expressjs/express/issues/7560',
    expectedRepo: 'expressjs/express',
    expectedIssueNumber: 7560,
    checkType: 'bug',
  },
  {
    category: '3. UI / CSS styling issue',
    url: 'https://github.com/tailwindlabs/tailwindcss/issues/19463',
    expectedRepo: 'tailwindlabs/tailwindcss',
    expectedIssueNumber: 19463,
    checkType: 'ui',
  },
  {
    category: '4. Repository with missing/incomplete contribution guide',
    url: 'https://github.com/sindresorhus/is/issues/220',
    expectedRepo: 'sindresorhus/is',
    expectedIssueNumber: 220,
    checkType: 'missing_contributing',
  },
  {
    category: '5. Closed or already-assigned issue',
    url: 'https://github.com/vercel/next.js/issues/100662',
    expectedRepo: 'vercel/next.js',
    expectedIssueNumber: 100662,
    checkType: 'assigned_or_closed',
  },
];

describe('Real Public GitHub Issues Evaluation Suite', () => {
  for (const item of EVAL_REAL_ISSUES) {
    it(`evaluates [${item.category}]: ${item.url}`, async () => {
      const result = await createBriefingFromUrl(item.url, { enableAi: false });

      if (!result.success) {
        // If unauthenticated rate limit was hit, handle gracefully
        if (result.error.status === 403 || result.error.code === 'FORBIDDEN_OR_RATE_LIMITED') {
          console.warn(`[RATE_LIMITED] GitHub API rate limit reached for ${item.url}`);
          expect(result.error.code).toBe('FORBIDDEN_OR_RATE_LIMITED');
          return;
        }
        throw new Error(`Evaluation failed for ${item.url}: [${result.error.code}] ${result.error.message}`);
      }

      const { briefing, context } = result;

      // 1. Verify Grounded Repository & Issue Identification
      expect(briefing.repository.fullName).toBe(item.expectedRepo);
      expect(briefing.issue.issueNumber).toBe(item.expectedIssueNumber);
      expect(briefing.issue.canonicalUrl).toBe(item.url);
      expect(briefing.summary.length).toBeGreaterThan(10);

      // 2. Verify Heuristic Difficulty & Time
      expect(['beginner', 'intermediate', 'advanced']).toContain(briefing.difficulty);
      expect(briefing.estimatedTimeMinutes.minMinutes).toBeGreaterThanOrEqual(15);
      expect(briefing.estimatedTimeMinutes.maxMinutes).toBeGreaterThanOrEqual(briefing.estimatedTimeMinutes.minMinutes);
      expect(briefing.difficultyRationale).toBeTruthy();

      // 3. Verify Candidate File Grounding (All candidate paths must exist in context.fileTree)
      const validPaths = new Set(context.fileTree.retainedPaths);
      for (const candidate of briefing.candidateFiles) {
        expect(validPaths.has(candidate.path)).toBe(true);
      }

      // 4. Verify Command Provenance Integrity
      for (const cmd of [...briefing.setupCommands, ...briefing.testCommands]) {
        expect(['verified_in_docs', 'inferred_from_tree', 'standard_fallback']).toContain(cmd.verificationStatus);
        expect(cmd.source).toBeTruthy();
        expect(cmd.command).toBeTruthy();
      }

      // 5. Verify Next Steps
      expect(briefing.nextSteps.length).toBeGreaterThanOrEqual(3);

      // 6. Category-specific checks
      if (item.checkType === 'missing_contributing') {
        expect(context.contributing.status).toBe('missing');
        expect(briefing.limitations.some((l) => l.toLowerCase().includes('contributing'))).toBe(true);
      }

      if (item.checkType === 'assigned_or_closed') {
        const isAssigned = briefing.issue.assignees.length > 0;
        const isClosed = briefing.issue.state === 'closed';
        expect(isAssigned || isClosed).toBe(true);
        if (isAssigned) {
          expect(briefing.warnings.some((w) => w.toLowerCase().includes('assigned'))).toBe(true);
        }
        if (isClosed) {
          expect(briefing.warnings.some((w) => w.toLowerCase().includes('closed'))).toBe(true);
        }
      }
    }, 45000); // 45s per remote issue
  }
});
