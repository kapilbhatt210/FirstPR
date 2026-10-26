import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { BriefingView } from '../components/BriefingView';
import { CommandCard } from '../components/CommandCard';
import { CopyButton } from '../components/CopyButton';
import { IssueForm } from '../components/IssueForm';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { EtiquetteChecklist } from '../components/EtiquetteChecklist';
import { PrDraftSection } from '../components/PrDraftSection';
import HomePage from '../app/page';
import { ContributionBriefing } from '../lib/briefing/schema';

function createMockBriefing(overrides?: Partial<ContributionBriefing>): ContributionBriefing {
  return {
    repository: {
      fullName: 'owner/awesome-repo',
      defaultBranch: 'main',
    },
    issue: {
      issueNumber: 42,
      title: 'Fix edge-case regression in parser',
      canonicalUrl: 'https://github.com/owner/awesome-repo/issues/42',
      state: 'open',
      assignees: [],
    },
    summary: 'The parser encounters an unexpected token on trailing commas.',
    difficulty: 'beginner',
    difficultyRationale: 'Localized parser logic with existing test coverage.',
    estimatedTimeMinutes: {
      minMinutes: 30,
      maxMinutes: 60,
      isEstimate: true,
    },
    candidateFiles: [
      {
        path: 'src/parser/tokenizer.ts',
        reason: 'Tokenizes incoming stream including comma tokens.',
        confidence: 'high',
      },
    ],
    setupCommands: [
      {
        command: 'npm install',
        source: 'README.md',
        verificationStatus: 'verified_in_docs',
        description: 'Install dependencies',
      },
    ],
    testCommands: [
      {
        command: 'npm test',
        source: 'package.json',
        verificationStatus: 'inferred_from_tree',
        description: 'Run test suite',
      },
      {
        command: 'npm run lint',
        source: 'standard fallback',
        verificationStatus: 'standard_fallback',
      },
    ],
    nextSteps: [
      'Clone repository',
      'Inspect tokenizer.ts',
      'Run npm test to verify regression',
    ],
    warnings: ['File tree was truncated during ingestion.'],
    limitations: ['Could not verify custom pre-commit hooks.'],
    generatedAt: '2026-10-26T12:00:00.000Z',
    ...overrides,
  };
}

describe('UI & Components Test Suite (Phase 5)', () => {
  describe('Navbar & Footer', () => {
    it('renders FirstPR wordmark and open-source readiness badge', () => {
      const html = renderToStaticMarkup(<Navbar />);
      expect(html).toContain('FirstPR');
      expect(html).toContain('Open-Source Readiness');
      expect(html).toContain('How it works');
    });

    it('renders privacy notice and disclaimer in footer', () => {
      const html = renderToStaticMarkup(<Footer />);
      expect(html).toContain('Privacy &amp; Data Processing');
      expect(html).toContain('read-only GitHub endpoints');
      expect(html).toContain('Gemma 4');
      expect(html).toContain('FirstPR never writes to your repositories');
    });
  });

  describe('HomePage Initial Empty State', () => {
    it('renders hero title, product promise, issue form, and empty-state workflow steps', () => {
      const html = renderToStaticMarkup(<HomePage />);
      expect(html).toContain('Paste an issue.');
      expect(html).toContain('Understand the work.');
      expect(html).toContain('Make your first contribution.');
      expect(html).toContain('GitHub Issue URL');
      expect(html).toContain('Enable AI Enhancement (Gemma 4)');
      expect(html).toContain('Generate Contribution Plan');
      expect(html).toContain('How FirstPR Prepares Your First PR');
      expect(html).toContain('Repository Ingestion');
      expect(html).toContain('Candidate Grounding');
      expect(html).toContain('Command Provenance');
      expect(html).toContain('PR Draft Ready');
    });
  });

  describe('IssueForm Component', () => {
    it('renders input, placeholder, AI toggle, and sample issues', () => {
      const html = renderToStaticMarkup(
        <IssueForm onSubmit={vi.fn()} isLoading={false} />
      );
      expect(html).toContain('issue-url-input');
      expect(html).toContain('vercel/next.js #50000');
      expect(html).toContain('expressjs/express #7560');
      expect(html).toContain('sindresorhus/is #220');
      expect(html).toContain('Optional');
    });

    it('renders loading state when isLoading is true', () => {
      const html = renderToStaticMarkup(
        <IssueForm onSubmit={vi.fn()} isLoading={true} />
      );
      expect(html).toContain('Analyzing Issue &amp; Repository...');
      expect(html).toContain('disabled=""');
    });

    it('renders server error alert when serverError is provided', () => {
      const html = renderToStaticMarkup(
        <IssueForm
          onSubmit={vi.fn()}
          isLoading={false}
          serverError={{
            code: 'NOT_FOUND',
            message: 'GitHub issue does not exist or is in a private repository.',
            details: 'Received 404 from api.github.com',
          }}
        />
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain('Request Failed (NOT_FOUND)');
      expect(html).toContain('GitHub issue does not exist or is in a private repository.');
      expect(html).toContain('Received 404 from api.github.com');
    });
  });

  describe('BriefingView Component', () => {
    it('renders all 9 sections in deterministic baseline mode', () => {
      const briefing = createMockBriefing();
      const html = renderToStaticMarkup(
        <BriefingView
          briefing={briefing}
          aiMetadata={{ enhanced: false }}
        />
      );

      // Section 1: Summary & Header
      expect(html).toContain('owner/awesome-repo');
      expect(html).toContain('Fix edge-case regression in parser');
      expect(html).toContain('The parser encounters an unexpected token on trailing commas.');
      expect(html).toContain('branch: <code class="text-slate-300">main</code>');

      // Section 2: Difficulty & Time Estimate
      expect(html).toContain('Good First Issue (Beginner)');
      expect(html).toContain('30–60 mins');
      expect(html).toContain('Localized parser logic with existing test coverage.');

      // Section 3: Candidate Files
      expect(html).toContain('Candidate Files to Inspect');
      expect(html).toContain('src/parser/tokenizer.ts');
      expect(html).toContain('high confidence');
      expect(html).toContain('Grounded exclusively in the repository file tree.');

      // Section 4: Workspace Commands with Provenance
      expect(html).toContain('Workspace Commands');
      expect(html).toContain('npm install');
      expect(html).toContain('Verified in Docs');
      expect(html).toContain('npm test');
      expect(html).toContain('Inferred from Files');
      expect(html).toContain('Standard Fallback (Unverified)');
      expect(html).toContain('Commands shown below have <em>not</em> been executed by FirstPR');

      // Section 5: Next Steps
      expect(html).toContain('Step-by-Step Contribution Plan');
      expect(html).toContain('Clone repository');
      expect(html).toContain('Inspect tokenizer.ts');

      // Section 6: Risks & Limitations
      expect(html).toContain('Risks &amp; Known Limitations');
      expect(html).toContain('File tree was truncated during ingestion.');
      expect(html).toContain('Could not verify custom pre-commit hooks.');

      // Section 7: PR Draft
      expect(html).toContain('Draft Pull Request');
      expect(html).toContain('Suggested PR Title');
      expect(html).toContain('Markdown Description');

      // Section 8: Contributor Etiquette Checklist
      expect(html).toContain('First-Time Contributor Etiquette Checklist');

      // Section 9: AI Status
      expect(html).toContain('Deterministic Briefing Engine (Safeguarded Baseline)');
      expect(html).toContain('100% deterministic • Zero hallucination');
    });

    it('renders AI-enhanced status badge when aiMetadata.enhanced is true', () => {
      const briefing = createMockBriefing();
      const html = renderToStaticMarkup(
        <BriefingView
          briefing={briefing}
          aiMetadata={{
            enhanced: true,
            provider: 'Gemma 4 Provider',
            model: 'gemma-4-26b-a4b-it',
          }}
        />
      );

      expect(html).toContain('AI-Enhanced via Gemma 4 Provider (gemma-4-26b-a4b-it)');
      expect(html).toContain('Repository evidence verified • AI insights advisory');
    });

    it('renders AI fallback warning if an AI error occurred', () => {
      const briefing = createMockBriefing();
      const html = renderToStaticMarkup(
        <BriefingView
          briefing={briefing}
          aiMetadata={{
            enhanced: false,
            error: 'Gemma 4 upstream rate limit reached (HTTP 429)',
          }}
        />
      );

      expect(html).toContain('AI enhancement fallback: Gemma 4 upstream rate limit reached (HTTP 429)');
      expect(html).toContain('Deterministic baseline preserved.');
    });

    it('renders prominent Closed Issue warning when state is closed', () => {
      const briefing = createMockBriefing({
        issue: {
          issueNumber: 42,
          title: 'Closed issue',
          canonicalUrl: 'https://github.com/owner/awesome-repo/issues/42',
          state: 'closed',
          assignees: [],
        },
      });

      const html = renderToStaticMarkup(<BriefingView briefing={briefing} />);
      expect(html).toContain('Closed Issue Warning');
      expect(html).toContain('This issue is marked as <strong>closed</strong> on GitHub.');
    });

    it('renders prominent Active Assignee warning when issue has assignees', () => {
      const briefing = createMockBriefing({
        issue: {
          issueNumber: 42,
          title: 'Assigned issue',
          canonicalUrl: 'https://github.com/owner/awesome-repo/issues/42',
          state: 'open',
          assignees: ['alice', 'bob'],
        },
      });

      const html = renderToStaticMarkup(<BriefingView briefing={briefing} />);
      expect(html).toContain('Active Assignee Warning');
      expect(html).toContain('@alice, @bob');
      expect(html).toContain('coordinate with the assignee before writing code');
    });
  });

  describe('CommandCard Component', () => {
    it('renders command text, source file, copy button, and verified badge', () => {
      const html = renderToStaticMarkup(
        <CommandCard
          command={{
            command: 'cargo test --all',
            source: 'CONTRIBUTING.md',
            verificationStatus: 'verified_in_docs',
            description: 'Run entire Rust test suite',
          }}
        />
      );

      expect(html).toContain('cargo test --all');
      expect(html).toContain('via CONTRIBUTING.md');
      expect(html).toContain('Verified in Docs');
      expect(html).toContain('Run entire Rust test suite');
      expect(html).toContain('Copy command');
    });
  });

  describe('EtiquetteChecklist Component', () => {
    it('renders list of etiquette rules and progress indicator', () => {
      const html = renderToStaticMarkup(<EtiquetteChecklist />);
      expect(html).toContain('Read repository contribution guidelines');
      expect(html).toContain('Check issue assignment and recent comment activity');
      expect(html).toContain('Fork repository and create a focused topic branch');
      expect(html).toContain('Write or update tests for your changes');
      expect(html).toContain('Run the project test suite and linter locally before pushing');
      expect(html).toContain('Be patient and respectful during code review');
      expect(html).toContain('0 of 7 checked');
    });
  });

  describe('PrDraftSection Component', () => {
    it('renders PR title, description, copy actions, and disclaimers', () => {
      const briefing = createMockBriefing();
      const html = renderToStaticMarkup(<PrDraftSection briefing={briefing} />);

      expect(html).toContain('Draft Pull Request');
      expect(html).toContain('Suggested PR Title');
      expect(html).toContain('fix: fix edge-case regression in parser (#42)');
      expect(html).toContain('Copy title');
      expect(html).toContain('Copy description');
      expect(html).toContain('FirstPR does not submit pull requests to GitHub');
    });
  });

  describe('CopyButton Component', () => {
    it('renders accessible button with label and SVG icon', () => {
      const html = renderToStaticMarkup(
        <CopyButton textToCopy="npm test" label="Copy command" />
      );
      expect(html).toContain('Copy command');
      expect(html).toContain('aria-label="Copy command"');
    });
  });
});
