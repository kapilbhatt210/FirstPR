import { ContributionBriefing } from './schema';
import { GitHubIssueContext } from '../github/types';

export interface PrDraft {
  title: string;
  description: string;
}

/**
 * Generates a structured draft PR title and markdown description
 * based on the contribution briefing and GitHub context.
 */
export function generatePrDraft(
  briefing: ContributionBriefing,
  context?: GitHubIssueContext
): PrDraft {
  const issueNum = briefing.issue.issueNumber;
  let cleanTitle = briefing.issue.title.trim().replace(/\.$/, '');

  // Strip existing conventional prefix if already present (e.g. "fix: ...", "documentation: ...")
  const prefixMatch = cleanTitle.match(/^([a-z]+)(\([a-z0-9_-]+\))?:\s*(.+)$/i);
  let prefix = 'fix';
  if (prefixMatch) {
    const rawPrefix = prefixMatch[1].toLowerCase();
    if (rawPrefix === 'documentation' || rawPrefix === 'doc') {
      prefix = 'docs';
    } else if (rawPrefix === 'feature') {
      prefix = 'feat';
    } else if (rawPrefix === 'bug' || rawPrefix === 'bugfix') {
      prefix = 'fix';
    } else {
      prefix = rawPrefix;
    }
    cleanTitle = prefixMatch[3];
  } else {
    const lower = cleanTitle.toLowerCase();
    if (lower.startsWith('add ') || lower.startsWith('feat') || lower.startsWith('implement') || lower.startsWith('support')) {
      prefix = 'feat';
    } else if (lower.startsWith('doc') || lower.startsWith('readme')) {
      prefix = 'docs';
    } else if (lower.startsWith('test')) {
      prefix = 'test';
    } else if (lower.startsWith('refactor') || lower.startsWith('clean')) {
      prefix = 'refactor';
    }
  }

  // Lowercase only the first letter to preserve technical casing like useEffect, GraphQL, etc.
  const formattedTitle = cleanTitle.charAt(0).toLowerCase() + cleanTitle.slice(1);
  const title = `${prefix}: ${formattedTitle} (#${issueNum})`;

  // Build candidate files change list
  const filesList = briefing.candidateFiles.length > 0
    ? briefing.candidateFiles
        .slice(0, 5)
        .map((f) => `- \`${f.path}\`: ${f.reason}`)
        .join('\n')
    : '- Identified relevant files based on issue scope.';

  // Build test verification instructions
  const testCmd = briefing.testCommands[0]?.command;
  const testLine = testCmd
    ? `- [ ] Run \`${testCmd}\` to verify changes`
    : '- [ ] Run the project test suite to verify changes';

  const defaultBranch = briefing.repository.defaultBranch || 'main';

  const guidelinesLine = context?.contributing?.status === 'present' && context.contributing.path
    ? `- [ ] Guidelines reviewed from \`${context.contributing.path}\``
    : '- [ ] Code follows repository contribution guidelines';

  const description = [
    `## Summary`,
    ``,
    briefing.summary,
    ``,
    `## Related Issue`,
    ``,
    `Closes #${issueNum} (${briefing.issue.canonicalUrl})`,
    ``,
    `## Proposed Changes`,
    ``,
    filesList,
    ``,
    `## Verification Plan`,
    ``,
    testLine,
    `- [ ] Ensure branch is rebased on \`${defaultBranch}\``,
    guidelinesLine,
    `- [ ] Confirm lint and build checks pass without warnings`,
    ``,
    `---`,
    `*Draft prepared with [FirstPR](https://github.com/firstpr/firstpr) — ready for human review.*`,
  ].join('\n');

  return { title, description };
}
