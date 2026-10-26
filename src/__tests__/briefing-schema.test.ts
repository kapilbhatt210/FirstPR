import { describe, it, expect } from 'vitest';
import {
  contributionBriefingSchema,
  timeRangeSchema,
  ContributionBriefing,
} from '../lib/briefing/schema';

describe('Contribution Briefing Zod Schema', () => {
  const validBriefing: ContributionBriefing = {
    repository: {
      fullName: 'facebook/react',
      defaultBranch: 'main',
    },
    issue: {
      issueNumber: 1234,
      title: 'Fix typo in documentation',
      canonicalUrl: 'https://github.com/facebook/react/issues/1234',
      state: 'open',
      assignees: [],
    },
    summary: 'Fix typo in documentation: Corrects misspelled word in getting started guide.',
    difficulty: 'beginner',
    difficultyRationale: 'Classified as beginner because of the "good first issue" label.',
    estimatedTimeMinutes: {
      minMinutes: 15,
      maxMinutes: 30,
      isEstimate: true,
    },
    candidateFiles: [
      {
        path: 'README.md',
        reason: 'Explicitly mentioned in issue text.',
        confidence: 'high',
      },
    ],
    setupCommands: [
      {
        command: 'npm install',
        description: 'Install dependencies',
        source: 'Documented in README',
        verificationStatus: 'verified_in_docs',
      },
    ],
    testCommands: [
      {
        command: 'npm test',
        description: 'Run tests',
        source: 'Documented in README',
        verificationStatus: 'verified_in_docs',
      },
    ],
    nextSteps: ['Clone repo', 'Create branch'],
    warnings: [],
    limitations: [],
    generatedAt: new Date().toISOString(),
  };

  it('validates a complete, valid contribution briefing object', () => {
    const result = contributionBriefingSchema.safeParse(validBriefing);
    expect(result.success).toBe(true);
  });

  it('defaults assignees, warnings, limitations, and isEstimate when omitted from input', () => {
    const minimalInput = {
      repository: {
        fullName: 'facebook/react',
        defaultBranch: 'main',
      },
      issue: {
        issueNumber: 1234,
        title: 'Fix typo in documentation',
        canonicalUrl: 'https://github.com/facebook/react/issues/1234',
      },
      summary: 'Fix typo in documentation',
      difficulty: 'beginner',
      difficultyRationale: 'Simple doc typo fix',
      estimatedTimeMinutes: {
        minMinutes: 15,
        maxMinutes: 30,
      },
      candidateFiles: [],
      setupCommands: [],
      testCommands: [],
      generatedAt: new Date().toISOString(),
    };
    const result = contributionBriefingSchema.safeParse(minimalInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.issue.assignees).toEqual([]);
      expect(result.data.warnings).toEqual([]);
      expect(result.data.limitations).toEqual([]);
      expect(result.data.estimatedTimeMinutes.isEstimate).toBe(true);
    }
  });

  it('allows nullable defaultBranch in repository', () => {
    const briefingWithNullBranch = {
      ...validBriefing,
      repository: {
        fullName: 'owner/no-branch',
        defaultBranch: null,
      },
    };
    const result = contributionBriefingSchema.safeParse(briefingWithNullBranch);
    expect(result.success).toBe(true);
  });

  it('rejects invalid difficulty levels', () => {
    const invalid = {
      ...validBriefing,
      difficulty: 'expert', // not allowed
    };
    const result = contributionBriefingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects time ranges where maxMinutes < minMinutes', () => {
    const invalidTime = {
      minMinutes: 60,
      maxMinutes: 30,
    };
    const result = timeRangeSchema.safeParse(invalidTime);
    expect(result.success).toBe(false);
  });

  it('rejects candidate files with empty paths', () => {
    const invalid = {
      ...validBriefing,
      candidateFiles: [
        {
          path: '',
          reason: 'No path provided',
          confidence: 'high' as const,
        },
      ],
    };
    const result = contributionBriefingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
