import { ParsedGitHubIssueUrl } from './types';

/**
 * Result type for parsing operations.
 */
export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// GitHub usernames/organizations: 1-39 alphanumeric characters or hyphens (not leading/trailing)
const GITHUB_OWNER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

// GitHub repository names: 1-100 characters, alphanumeric, hyphen, underscore, or period
const GITHUB_REPO_REGEX = /^[a-zA-Z0-9_.-]+$/;

// Issue numbers: positive integers only
const ISSUE_NUMBER_REGEX = /^[1-9]\d*$/;

/**
 * Parses and strictly validates a GitHub issue URL according to Phase 2 rules.
 *
 * Expected format: https://github.com/{owner}/{repo}/issues/{issue_number}
 *
 * Rejects:
 * - Non-https protocols
 * - Non-github.com hosts
 * - Pull request URLs (/pull/123)
 * - Query strings and URL hash fragments
 * - Invalid or non-positive issue numbers
 * - Malformed owner/repo names or path traversal
 */
export function parseGitHubIssueUrl(rawInput: string): ParseResult<ParsedGitHubIssueUrl> {
  if (!rawInput || typeof rawInput !== 'string') {
    return { success: false, error: 'Issue URL must be a non-empty string' };
  }

  const trimmed = rawInput.trim();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { success: false, error: 'Malformed URL: unable to parse as a valid URL' };
  }

  // Enforce HTTPS
  if (url.protocol !== 'https:') {
    return { success: false, error: 'URL protocol must be https:' };
  }

  // Enforce strictly github.com hostname (case-insensitive)
  if (url.hostname.toLowerCase() !== 'github.com') {
    return {
      success: false,
      error: `Invalid hostname "${url.hostname}". Hostname must strictly be "github.com"`,
    };
  }

  // Reject unexpected query parameters
  if (url.search && url.search !== '?') {
    return {
      success: false,
      error: 'Unexpected query parameters. Issue URLs must not contain query strings.',
    };
  }

  // Reject unexpected hash fragments
  if (url.hash && url.hash !== '#') {
    return {
      success: false,
      error: 'Unexpected URL fragment. Issue URLs must not contain hash fragments.',
    };
  }

  // Path segments: normalize slashes
  const segments = url.pathname
    .split('/')
    .filter((segment) => segment.length > 0);

  const actionSegment = segments.length >= 3 ? segments[2].toLowerCase() : '';
  if (actionSegment === 'pull' || actionSegment === 'pulls') {
    return {
      success: false,
      error: 'Pull request URLs are not supported. Please provide a GitHub issue URL.',
    };
  }

  // Must match [owner, repo, "issues", issueNumber]
  if (segments.length !== 4 || segments[2].toLowerCase() !== 'issues') {
    return {
      success: false,
      error:
        'URL path must match the format: https://github.com/{owner}/{repo}/issues/{issue_number}',
    };
  }

  const [owner, rawRepo, , rawIssueNumber] = segments;

  // Validate owner
  if (owner.length > 39 || !GITHUB_OWNER_REGEX.test(owner)) {
    return {
      success: false,
      error: `Invalid repository owner "${owner}". Must be a valid GitHub user or organization name.`,
    };
  }

  // Validate repository name (also reject ending in .git, or traversing . or ..)
  if (
    rawRepo === '.' ||
    rawRepo === '..' ||
    rawRepo.length > 100 ||
    !GITHUB_REPO_REGEX.test(rawRepo)
  ) {
    return {
      success: false,
      error: `Invalid repository name "${rawRepo}".`,
    };
  }

  const repo = rawRepo.endsWith('.git') ? rawRepo.slice(0, -4) : rawRepo;
  if (!repo || repo === '.' || repo === '..') {
    return {
      success: false,
      error: `Invalid repository name "${rawRepo}".`,
    };
  }

  // Validate issue number
  if (!ISSUE_NUMBER_REGEX.test(rawIssueNumber)) {
    return {
      success: false,
      error: `Invalid issue number "${rawIssueNumber}". Must be a positive integer.`,
    };
  }

  const issueNumber = Number(rawIssueNumber);
  if (!Number.isSafeInteger(issueNumber) || issueNumber <= 0) {
    return {
      success: false,
      error: `Invalid issue number "${rawIssueNumber}". Must be a positive safe integer.`,
    };
  }

  // Canonical issue URL
  const canonicalUrl = `https://github.com/${owner}/${repo}/issues/${issueNumber}`;

  return {
    success: true,
    data: {
      owner,
      repo,
      issueNumber,
      canonicalUrl,
    },
  };
}
