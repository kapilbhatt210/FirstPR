import { describe, it, expect } from 'vitest';
import { generatePrDraft } from '../lib/briefing/pr-draft';
import { ContributionBriefing } from '../lib/briefing/schema';
import { GitHubIssueContext } from '../lib/github/types';

function createMockBriefing(overrides?: Partial<ContributionBriefing>): ContributionBriefing {
  return {
    repository: {
      fullName: 'facebook/react',
      defaultBranch: 'main',
    },
    issue: {
      issueNumber: 28000,
      title: 'Fix edge-case memory leak in useEffect cleanup',
      canonicalUrl: 'https://github.com/facebook/react/issues/28000',
      state: 'open',
      assignees: [],
    },
    summary: 'A memory leak occurs when useEffect unmounts under high concurrency.',
    difficulty: 'intermediate',
    difficultyRationale: 'Requires understanding the concurrent fiber scheduler.',
    estimatedTimeMinutes: {
      minMinutes: 45,
      maxMinutes: 90,
      isEstimate: true,
    },
    candidateFiles: [
      {
        path: 'packages/react-reconciler/src/ReactFiberHooks.js',
        reason: 'Manages hook invocation and effect lists.',
        confidence: 'high',
      },
    ],
    setupCommands: [
      {
        command: 'yarn install',
        source: 'README.md',
        verificationStatus: 'verified_in_docs',
      },
    ],
    testCommands: [
      {
        command: 'yarn test ReactFiberHooks',
        source: 'package.json',
        verificationStatus: 'inferred_from_tree',
      },
    ],
    nextSteps: [
      'Clone repository',
      'Create topic branch',
      'Run tests',
    ],
    warnings: [],
    limitations: [],
    generatedAt: '2026-10-26T12:00:00.000Z',
    ...overrides,
  };
}

describe('PR Draft Generator (pr-draft.ts)', () => {
  it('generates a conventional commit title referencing the issue number', () => {
    const briefing = createMockBriefing();
    const draft = generatePrDraft(briefing);

    expect(draft.title).toContain('fix: fix edge-case memory leak in useEffect cleanup (#28000)');
  });

  it('detects feature prefix when issue title starts with add or implement', () => {
    const briefing = createMockBriefing({
      issue: {
        issueNumber: 101,
        title: 'Add support for async transitions',
        canonicalUrl: 'https://github.com/facebook/react/issues/101',
        state: 'open',
        assignees: [],
      },
    });
    const draft = generatePrDraft(briefing);

    expect(draft.title).toBe('feat: add support for async transitions (#101)');
  });

  it('detects docs prefix when issue title starts with doc or readme', () => {
    const briefing = createMockBriefing({
      issue: {
        issueNumber: 202,
        title: 'Documentation: update installation instructions',
        canonicalUrl: 'https://github.com/facebook/react/issues/202',
        state: 'open',
        assignees: [],
      },
    });
    const draft = generatePrDraft(briefing);

    expect(draft.title).toBe('docs: update installation instructions (#202)');
  });

  it('includes summary, related issue link, and candidate files in description', () => {
    const briefing = createMockBriefing();
    const draft = generatePrDraft(briefing);

    expect(draft.description).toContain('## Summary');
    expect(draft.description).toContain(briefing.summary);
    expect(draft.description).toContain('Closes #28000 (https://github.com/facebook/react/issues/28000)');
    expect(draft.description).toContain('packages/react-reconciler/src/ReactFiberHooks.js');
    expect(draft.description).toContain('yarn test ReactFiberHooks');
    expect(draft.description).toContain('rebased on `main`');
  });

  it('references CONTRIBUTING.md when present in context', () => {
    const briefing = createMockBriefing();
    const mockContext = {
      contributing: {
        status: 'present',
        path: '.github/CONTRIBUTING.md',
      },
    } as unknown as GitHubIssueContext;

    const draft = generatePrDraft(briefing, mockContext);
    expect(draft.description).toContain('Guidelines reviewed from `.github/CONTRIBUTING.md`');
  });

  it('falls back to generic contribution guidance line when CONTRIBUTING is missing', () => {
    const briefing = createMockBriefing();
    const draft = generatePrDraft(briefing);
    expect(draft.description).toContain('Code follows repository contribution guidelines');
  });
});
