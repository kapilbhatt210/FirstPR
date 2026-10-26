import { GitHubIssueContext } from '../github/types';
import {
  CandidateFile,
  CommandItem,
  ContributionBriefing,
  DifficultyLevel,
  TimeRange,
  contributionBriefingSchema,
} from './schema';

// Common beginner labels (case-insensitive)
const BEGINNER_LABELS = [
  'good first issue',
  'good-first-issue',
  'first-timers-only',
  'beginner',
  'easy',
  'documentation',
  'docs',
  'typo',
  'starter',
];

// High complexity labels (case-insensitive)
const ADVANCED_LABELS = [
  'architecture',
  'breaking change',
  'concurrency',
  'security',
  'cve',
  'performance',
  'memory leak',
  'refactor',
  'complex',
  'critical',
];

// Concrete beginner keywords (removed ambiguous words like 'link' or 'docs' alone)
const BEGINNER_KEYWORDS = [
  'typo',
  'spelling',
  'broken link',
  'docstring',
  'grammatical',
  'formatting fix',
  'documentation typo',
  'minor docs',
];

// Concrete advanced keywords (removed ambiguous words like 'leak' or 'overflow' alone)
const ADVANCED_KEYWORDS = [
  'deadlock',
  'race condition',
  'memory corruption',
  'memory leak',
  'concurrency issue',
  'security vulnerability',
  'buffer overflow',
  'integer overflow',
  'architecture overhaul',
  'breaking change',
];

/**
 * Checks whether a repository path is a safe relative path.
 * Disallows traversal (..), leading slashes, backslashes, and null bytes.
 */
export function isSafeRelativePath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  const trimmed = path.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) return false;
  if (trimmed.includes('\0')) return false;
  const parts = trimmed.split(/[/\\]/);
  return !parts.includes('..') && !parts.includes('.');
}

/**
 * Strips markdown markup, image tags, code fences, and extra whitespace to form a plain summary.
 * Note: Text cleanup is for presentation formatting only and is NOT a security boundary.
 */
function cleanIssueText(text: string): string {
  if (!text) return '';
  // Bound input size to avoid excessive processing on huge untrusted payloads
  const safeSlice = text.slice(0, 10000);
  return safeSlice
    .replace(/<script[\s\S]*?<\/script>/gi, '') // strip scripts and contents
    .replace(/<style[\s\S]*?<\/style>/gi, '') // strip styles and contents
    .replace(/```[\s\S]*?```/g, '') // strip multi-line code blocks
    .replace(/`([^`]+)`/g, '$1') // strip inline code
    .replace(/!\[.*?\]\(.*?\)/g, '') // strip images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // flatten links to text
    .replace(/<[^>]*>/g, '') // strip HTML tags for clean presentation
    .replace(/^#+\s+/gm, '') // strip header markings
    .replace(/<!--[\s\S]*?-->/g, '') // strip HTML comments
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim();
}

/**
 * Generates a concise, presentation-safe summary from title and body.
 */
export function generateIssueSummary(title: string, body: string): string {
  const cleanTitle = title.trim();
  const cleanBody = cleanIssueText(body);

  if (!cleanBody) {
    return cleanTitle;
  }

  // Take first 1-2 sentences of body up to ~220 chars
  const firstSentenceMatch = cleanBody.match(/^([^.?!]+[.?!])/);
  const snippet = firstSentenceMatch ? firstSentenceMatch[1].trim() : cleanBody.slice(0, 180).trim();

  // If snippet is redundant with title, just return title + detail
  if (snippet.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
    return cleanBody.length > 220 ? `${cleanBody.slice(0, 220)}...` : cleanBody;
  }

  return `${cleanTitle}: ${snippet}`;
}

/**
 * Deterministically computes difficulty level and honest rationale based on labels, title, and body.
 *
 * Rules:
 * 1. Checks for conflicting signals (beginner label/keyword + advanced label/keyword).
 * 2. Does NOT claim an issue is beginner-friendly solely because it has a "good first issue" label.
 * 3. Acknowledges uncertainty and explicitly communicates that estimates are approximate heuristics.
 */
export function assessDifficulty(
  labels: string[],
  title: string,
  body: string
): { difficulty: DifficultyLevel; rationale: string; timeRange: TimeRange } {
  const lowerLabels = labels.map((l) => l.toLowerCase());
  const combinedText = `${title} ${body}`.toLowerCase();

  const matchedBeginnerLabel = BEGINNER_LABELS.find((bl) =>
    lowerLabels.some((l) => l.includes(bl))
  );
  const matchedAdvancedLabel = ADVANCED_LABELS.find((al) =>
    lowerLabels.some((l) => l.includes(al))
  );

  const matchedBeginnerKeyword = BEGINNER_KEYWORDS.find((bk) =>
    combinedText.includes(bk)
  );
  const matchedAdvancedKeyword = ADVANCED_KEYWORDS.find((ak) =>
    combinedText.includes(ak)
  );

  const hasBeginnerSignal = Boolean(matchedBeginnerLabel || matchedBeginnerKeyword);
  const hasAdvancedSignal = Boolean(matchedAdvancedLabel || matchedAdvancedKeyword);

  // 1. Conflicting signals: both beginner and advanced indicators detected
  if (hasBeginnerSignal && hasAdvancedSignal) {
    const beginnerDetail = matchedBeginnerLabel
      ? `label "${matchedBeginnerLabel}"`
      : `keyword "${matchedBeginnerKeyword}"`;
    const advancedDetail = matchedAdvancedLabel
      ? `label "${matchedAdvancedLabel}"`
      : `keyword "${matchedAdvancedKeyword}"`;

    return {
      difficulty: 'intermediate',
      rationale: `Contradictory signals detected: issue contains beginner indicator (${beginnerDetail}) alongside advanced/complex indicator (${advancedDetail}). Conservatively estimated as intermediate due to conflicting complexity signals. Estimates are approximate heuristics, not guarantees.`,
      timeRange: { minMinutes: 90, maxMinutes: 240, isEstimate: true },
    };
  }

  // 2. Clear advanced indicators
  if (matchedAdvancedLabel) {
    return {
      difficulty: 'advanced',
      rationale: `Classified as advanced due to label "${matchedAdvancedLabel}" indicating elevated architectural or system complexity. Estimates are approximate heuristics, not guarantees.`,
      timeRange: { minMinutes: 240, maxMinutes: 480, isEstimate: true },
    };
  }

  if (matchedAdvancedKeyword) {
    return {
      difficulty: 'advanced',
      rationale: `Classified as advanced because the issue description mentions complex concepts ("${matchedAdvancedKeyword}"). Estimates are approximate heuristics, not guarantees.`,
      timeRange: { minMinutes: 180, maxMinutes: 360, isEstimate: true },
    };
  }

  // 3. Both beginner label and concrete keyword
  if (matchedBeginnerLabel && matchedBeginnerKeyword) {
    return {
      difficulty: 'beginner',
      rationale: `Classified as beginner because of maintainer label "${matchedBeginnerLabel}" and issue description focusing on "${matchedBeginnerKeyword}". Estimates are approximate heuristics, not guarantees.`,
      timeRange: { minMinutes: 15, maxMinutes: 45, isEstimate: true },
    };
  }

  // 4. Concrete beginner tasks (typos, docs, spelling)
  if (matchedBeginnerKeyword) {
    return {
      difficulty: 'beginner',
      rationale: `Classified as beginner because the issue focuses on a bounded task related to "${matchedBeginnerKeyword}". Estimates are approximate heuristics, not guarantees.`,
      timeRange: { minMinutes: 15, maxMinutes: 45, isEstimate: true },
    };
  }

  // 5. Beginner label only (honest rationale: does not guarantee simplicity)
  if (matchedBeginnerLabel) {
    return {
      difficulty: 'beginner',
      rationale: `Maintainers tagged this issue with "${matchedBeginnerLabel}", suggesting it may be accessible to new contributors, though environment setup and repository familiarity are still required. Estimates are approximate heuristics, not guarantees.`,
      timeRange: { minMinutes: 20, maxMinutes: 60, isEstimate: true },
    };
  }

  // 6. Default / Insufficient evidence
  return {
    difficulty: 'intermediate',
    rationale:
      'Insufficient or ambiguous complexity signals in issue metadata; defaulting to a conservative intermediate estimate (60–180 minutes). Estimates are approximate heuristics, not guarantees.',
    timeRange: { minMinutes: 60, maxMinutes: 180, isEstimate: true },
  };
}

/**
 * Escapes regex special characters in a literal string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Deterministically identifies candidate files relevant to the issue.
 *
 * Rules:
 * - Every candidate file MUST strictly exist in the supplied repository tree.
 * - Negative check: Unsafe paths (traversal, absolute) or nonexistent files are rejected.
 * - If no credible candidate exists, returns empty array (does not invent files).
 */
export function identifyCandidateFiles(
  title: string,
  body: string,
  retainedPaths: string[],
  difficulty: DifficultyLevel
): CandidateFile[] {
  const safePaths = retainedPaths.filter(isSafeRelativePath);
  const pathSet = new Set(safePaths);
  const candidates: CandidateFile[] = [];
  const combinedText = `${title}\n${body}`;

  // 1. Look for explicit path matches that exist in the repository tree
  for (const path of safePaths) {
    if (path.length >= 3) {
      // Ensure path is matched with surrounding delimiter or whitespace to prevent accidental substrings
      const pattern = new RegExp(`(?:^|[\\s\`'"(\\[<])${escapeRegex(path)}(?:[\\s\`'")\\]>,.:;]|$)`);
      if (pattern.test(combinedText)) {
        if (pathSet.has(path) && !candidates.some((c) => c.path === path)) {
          candidates.push({
            path,
            reason: 'Explicitly referenced in the issue title or description.',
            confidence: 'high',
          });
        }
      }
    }
  }

  // 2. Look for basename matches (e.g. "Button.tsx" or "server.ts")
  if (candidates.length < 5) {
    for (const path of safePaths) {
      const basename = path.split('/').pop();
      // Require filename to be at least 4 characters and have an extension
      if (basename && basename.length >= 4 && basename.includes('.')) {
        // Exclude ubiquitous generic files from loose matching unless delimited
        const isGenericName = ['index.ts', 'index.js', 'index.tsx', 'main.go', 'mod.rs'].includes(basename);
        if (!isGenericName) {
          const pattern = new RegExp(`(?:^|[\\s\`'"(\\[<])${escapeRegex(basename)}(?:[\\s\`'")\\]>,.:;]|$)`);
          if (pattern.test(combinedText)) {
            if (pathSet.has(path) && !candidates.some((c) => c.path === path)) {
              candidates.push({
                path,
                reason: `Filename "${basename}" is mentioned in the issue text.`,
                confidence: 'medium',
              });
            }
          }
        }
      }
    }
  }

  // 3. For beginner documentation tasks, identify documented doc files in tree
  if (candidates.length < 5 && difficulty === 'beginner') {
    const isDocTask =
      combinedText.toLowerCase().includes('typo') ||
      combinedText.toLowerCase().includes('readme') ||
      combinedText.toLowerCase().includes('documentation') ||
      combinedText.toLowerCase().includes('docs') ||
      combinedText.toLowerCase().includes('docstring');

    if (isDocTask) {
      const docFiles = safePaths.filter(
        (p) =>
          p === 'README.md' ||
          p === 'CONTRIBUTING.md' ||
          p.startsWith('docs/') ||
          p.endsWith('.md')
      );
      for (const docFile of docFiles) {
        if (pathSet.has(docFile) && !candidates.some((c) => c.path === docFile)) {
          candidates.push({
            path: docFile,
            reason: 'Documentation file in repository tree relevant for documentation task.',
            confidence: 'medium',
          });
          if (candidates.length >= 3) break;
        }
      }
    }
  }

  // When no credible candidate exists, DO NOT invent files. Return only validated paths.
  return candidates.slice(0, 5);
}

/**
 * Extracts setup and test commands from documentation text or infers from repository tree.
 *
 * Rules:
 * - verified_in_docs: Only when full command is explicitly written in docs (not loose mentions).
 * - inferred_from_tree: Notes evidence (manifest/lockfile) and clarifies that scripts are unverified.
 * - standard_fallback: Clearly presented as unverified generic suggestions without assuming npm.
 */
export function extractCommands(
  contributingContent: string | undefined,
  readmeContent: string | undefined,
  retainedPaths: string[]
): { setupCommands: CommandItem[]; testCommands: CommandItem[] } {
  const safePaths = retainedPaths.filter(isSafeRelativePath);
  const docsText = `${contributingContent || ''}\n${readmeContent || ''}`;

  const setupCommands: CommandItem[] = [];
  const testCommands: CommandItem[] = [];

  // 1. Explicit command extraction from documentation (must be the full command, not just tool name)
  const pnpmInstall = docsText.match(/\bpnpm\s+install\b/i);
  const yarnInstall = docsText.match(/\byarn\s+install\b/i);
  const npmInstall = docsText.match(/\bnpm\s+install\b/i);
  const cargoBuild = docsText.match(/\bcargo\s+build\b/i);
  const pipInstall = docsText.match(/\bpip\s+install\s+-[r]\s+[\w.-]+/i);

  const npmTest = docsText.match(/\b(npm\s+test|npm\s+run\s+test)\b/i);
  const pnpmTest = docsText.match(/\b(pnpm\s+test|pnpm\s+run\s+test)\b/i);
  const yarnTest = docsText.match(/\byarn\s+test\b/i);
  const cargoTest = docsText.match(/\bcargo\s+test\b/i);
  const pytest = docsText.match(/\bpytest\b/i);

  if (pnpmInstall) {
    setupCommands.push({
      command: 'pnpm install',
      description: 'Install dependencies using pnpm (documented in repository docs; not executed)',
      source: 'Explicitly documented in repository contribution guide or README',
      verificationStatus: 'verified_in_docs',
    });
  } else if (yarnInstall) {
    setupCommands.push({
      command: 'yarn install',
      description: 'Install dependencies using Yarn (documented in repository docs; not executed)',
      source: 'Explicitly documented in repository contribution guide or README',
      verificationStatus: 'verified_in_docs',
    });
  } else if (npmInstall) {
    setupCommands.push({
      command: 'npm install',
      description: 'Install dependencies using npm (documented in repository docs; not executed)',
      source: 'Explicitly documented in repository contribution guide or README',
      verificationStatus: 'verified_in_docs',
    });
  } else if (cargoBuild) {
    setupCommands.push({
      command: 'cargo build',
      description: 'Build Rust crate and dependencies (documented in repository docs; not executed)',
      source: 'Explicitly documented in repository contribution guide or README',
      verificationStatus: 'verified_in_docs',
    });
  } else if (pipInstall) {
    setupCommands.push({
      command: pipInstall[0],
      description: 'Install Python dependencies (documented in repository docs; not executed)',
      source: 'Explicitly documented in repository contribution guide or README',
      verificationStatus: 'verified_in_docs',
    });
  }

  if (pnpmTest) {
    testCommands.push({
      command: pnpmTest[0],
      description: 'Run project tests using pnpm (documented in repository docs; not executed)',
      source: 'Explicitly documented in repository contribution guide or README',
      verificationStatus: 'verified_in_docs',
    });
  } else if (yarnTest) {
    testCommands.push({
      command: 'yarn test',
      description: 'Run project tests using Yarn (documented in repository docs; not executed)',
      source: 'Explicitly documented in repository contribution guide or README',
      verificationStatus: 'verified_in_docs',
    });
  } else if (npmTest) {
    testCommands.push({
      command: npmTest[0],
      description: 'Run project test suite using npm (documented in repository docs; not executed)',
      source: 'Explicitly documented in repository contribution guide or README',
      verificationStatus: 'verified_in_docs',
    });
  } else if (cargoTest) {
    testCommands.push({
      command: 'cargo test',
      description: 'Run Rust tests with cargo (documented in repository docs; not executed)',
      source: 'Explicitly documented in repository contribution guide or README',
      verificationStatus: 'verified_in_docs',
    });
  } else if (pytest) {
    testCommands.push({
      command: 'pytest',
      description: 'Run Python test suite with pytest (documented in repository docs; not executed)',
      source: 'Explicitly documented in repository contribution guide or README',
      verificationStatus: 'verified_in_docs',
    });
  }

  // 2. Infer from repository tree manifests if not verified in docs
  if (setupCommands.length === 0) {
    if (safePaths.includes('pnpm-lock.yaml')) {
      setupCommands.push({
        command: 'pnpm install',
        description: 'Suggested dependency installation based on pnpm-lock.yaml (unverified; not executed)',
        source: 'Inferred from presence of pnpm-lock.yaml in repository file tree',
        verificationStatus: 'inferred_from_tree',
      });
    } else if (safePaths.includes('yarn.lock')) {
      setupCommands.push({
        command: 'yarn install',
        description: 'Suggested dependency installation based on yarn.lock (unverified; not executed)',
        source: 'Inferred from presence of yarn.lock in repository file tree',
        verificationStatus: 'inferred_from_tree',
      });
    } else if (safePaths.includes('package.json')) {
      setupCommands.push({
        command: 'npm install',
        description: 'Suggested dependency installation based on package.json (unverified; not executed)',
        source: 'Inferred from presence of package.json in repository file tree',
        verificationStatus: 'inferred_from_tree',
      });
    } else if (safePaths.includes('Cargo.toml')) {
      setupCommands.push({
        command: 'cargo build',
        description: 'Suggested build command based on Cargo.toml (unverified; not executed)',
        source: 'Inferred from presence of Cargo.toml in repository file tree',
        verificationStatus: 'inferred_from_tree',
      });
    } else if (safePaths.includes('requirements.txt')) {
      setupCommands.push({
        command: 'pip install -r requirements.txt',
        description: 'Suggested dependency installation based on requirements.txt (unverified; not executed)',
        source: 'Inferred from presence of requirements.txt in repository file tree',
        verificationStatus: 'inferred_from_tree',
      });
    } else {
      setupCommands.push({
        command: 'git status',
        description: 'Unverified suggestion: inspect repository status. No package or build manifest detected in file tree.',
        source: 'Generic fallback suggestion (no build manifest identified in repository tree)',
        verificationStatus: 'standard_fallback',
      });
    }
  }

  if (testCommands.length === 0) {
    if (safePaths.includes('pnpm-lock.yaml')) {
      testCommands.push({
        command: 'pnpm test',
        description: 'Suggested test command based on pnpm-lock.yaml. Presence of lockfile does not guarantee a "test" script is defined.',
        source: 'Inferred from presence of pnpm-lock.yaml in repository tree (unverified whether test script is configured)',
        verificationStatus: 'inferred_from_tree',
      });
    } else if (safePaths.includes('yarn.lock')) {
      testCommands.push({
        command: 'yarn test',
        description: 'Suggested test command based on yarn.lock. Presence of lockfile does not guarantee a "test" script is defined.',
        source: 'Inferred from presence of yarn.lock in repository tree (unverified whether test script is configured)',
        verificationStatus: 'inferred_from_tree',
      });
    } else if (safePaths.includes('package.json')) {
      testCommands.push({
        command: 'npm test',
        description: 'Suggested test command based on package.json. Presence of package.json does not guarantee a "test" script is defined.',
        source: 'Inferred from presence of package.json in repository tree (unverified whether test script is configured)',
        verificationStatus: 'inferred_from_tree',
      });
    } else if (safePaths.includes('Cargo.toml')) {
      testCommands.push({
        command: 'cargo test',
        description: 'Suggested test command based on Cargo.toml (unverified; not executed)',
        source: 'Inferred from presence of Cargo.toml in repository tree (unverified whether tests are configured)',
        verificationStatus: 'inferred_from_tree',
      });
    } else {
      // Do not assume npm when package.json is absent!
      testCommands.push({
        command: 'echo "Check repository documentation for test instructions"',
        description: 'Unverified suggestion: no test runner or configuration was detected in the repository file tree.',
        source: 'Generic fallback suggestion (no test configuration identified in repository tree)',
        verificationStatus: 'standard_fallback',
      });
    }
  }

  return { setupCommands, testCommands };
}

/**
 * Generates actionable next steps tailored to issue state and verification status.
 */
function generateNextSteps(
  issueNumber: number,
  isClosed: boolean,
  assigneeLogins: string[],
  setupCommand: string,
  testCommand: string
): string[] {
  const steps: string[] = [];

  if (isClosed) {
    steps.push(`Note: Issue #${issueNumber} is closed. Review closed discussion or confirm with maintainers before working.`);
  }

  if (assigneeLogins.length > 0) {
    steps.push(`Coordinate with current assignee(s) (${assigneeLogins.join(', ')}) before beginning duplicate work.`);
  }

  steps.push('Fork the repository on GitHub and clone your fork locally.');
  steps.push(`Create a focused working branch: git checkout -b fix/issue-${issueNumber}`);
  steps.push(`Prepare your local environment: ${setupCommand}`);
  steps.push('Inspect candidate files and implement your changes.');
  steps.push(`Run local verification (if configured): ${testCommand}`);
  steps.push(`Commit changes and open a pull request referencing issue #${issueNumber}.`);

  return steps;
}

/**
 * Main briefing generation function.
 * Given a GitHubIssueContext, deterministically constructs and validates a ContributionBriefing.
 */
export function generateContributionBriefing(context: GitHubIssueContext): ContributionBriefing {
  const { repository, issue, readme, contributing, fileTree } = context;

  const summary = generateIssueSummary(issue.title, issue.body);
  const labelNames = issue.labels.map((l) => l.name);

  const { difficulty, rationale, timeRange } = assessDifficulty(
    labelNames,
    issue.title,
    issue.body
  );

  const candidateFiles = identifyCandidateFiles(
    issue.title,
    issue.body,
    fileTree.retainedPaths,
    difficulty
  );

  const { setupCommands, testCommands } = extractCommands(
    contributing.content,
    readme.content,
    fileTree.retainedPaths
  );

  const assigneeLogins = (issue.assignees || []).map((a) => a.login);
  const isClosed = issue.state === 'closed';

  const nextSteps = generateNextSteps(
    issue.issueNumber,
    isClosed,
    assigneeLogins,
    setupCommands[0]?.command || 'git status',
    testCommands[0]?.command || 'npm test'
  );

  // Collect warnings based on actual data
  const warnings: string[] = [];
  if (isClosed) {
    warnings.push(
      `Issue #${issue.issueNumber} is marked as CLOSED on GitHub. Contributions to closed issues may not be accepted.`
    );
  }
  if (assigneeLogins.length > 0) {
    warnings.push(
      `Issue #${issue.issueNumber} is currently assigned to: ${assigneeLogins.join(', ')}. Coordinate before working to prevent duplicate effort.`
    );
  }
  if (repository.defaultBranch === null) {
    warnings.push(
      'Repository default branch could not be verified from the GitHub API; verify branch before cloning.'
    );
  }

  // Collect limitations based on candidate grounding and test commands
  const limitations: string[] = [];
  if (candidateFiles.length === 0) {
    limitations.push(
      'No candidate files could be confidently identified from the issue description within the repository file tree. Manual code exploration is required.'
    );
  }
  if (testCommands[0]?.verificationStatus === 'standard_fallback') {
    limitations.push(
      'No test runner or package configuration was identified in repository documentation or file tree. Verification command is unverified.'
    );
  }

  const rawBriefing: ContributionBriefing = {
    repository: {
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
    },
    issue: {
      issueNumber: issue.issueNumber,
      title: issue.title,
      canonicalUrl: issue.canonicalUrl,
      state: issue.state,
      assignees: assigneeLogins,
    },
    summary,
    difficulty,
    difficultyRationale: rationale,
    estimatedTimeMinutes: timeRange,
    candidateFiles,
    setupCommands,
    testCommands,
    nextSteps,
    warnings,
    limitations,
    generatedAt: new Date().toISOString(),
  };

  // Validate against Zod schema to guarantee contract compliance
  return contributionBriefingSchema.parse(rawBriefing);
}
