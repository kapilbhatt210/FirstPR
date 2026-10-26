import {
  BoundedFileTree,
  DocumentContentStatus,
  GitHubCommentItem,
  GitHubIssueMetadata,
  GitHubRepositoryMetadata,
  IngestionError,
  IngestionErrorCode,
} from './types';

// Enforced constant host for all outbound requests
export const GITHUB_API_BASE = 'https://api.github.com';

// Limits for bounded responses
export const MAX_README_CHARS = 20000;
export const MAX_CONTRIBUTING_CHARS = 20000;
export const MAX_COMMENT_CHARS = 5000;
export const MAX_RETAINED_FILE_PATHS = 100;
export const DEFAULT_REQUEST_TIMEOUT_MS = 8000;
export const MAX_REDIRECT_HOPS = 3;
export const MAX_REQUEST_BODY_BYTES = 16384;

// Common paths where CONTRIBUTING guidelines reside in repositories
export const CONTRIBUTING_CANDIDATE_PATHS = [
  'CONTRIBUTING.md',
  '.github/CONTRIBUTING.md',
  'docs/CONTRIBUTING.md',
  'contributing.md',
];

// Noisy files/directories to exclude from bounded file tree to preserve contribution signal
const TREE_IGNORE_PATTERNS = [
  /(^|\/)\.git\//,
  /(^|\/)node_modules\//,
  /(^|\/)\.next\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)out\//,
  /(^|\/)coverage\//,
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb)$/,
  /\.(png|jpe?g|gif|svg|ico|webp|avif|woff2?|eot|ttf|otf|mp4|webm|zip|tar\.gz|pdf)$/i,
];

/**
 * Validates whether a branch name complies with safe git reference syntax.
 * Rejects control characters, path traversals ('..'), spaces, and git ref special symbols.
 */
export function isValidGitBranchName(branch: unknown): branch is string {
  if (typeof branch !== 'string') return false;
  const trimmed = branch.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return false;

  // Disallow git ref illegal sequences:
  // - contains '..'
  // - contains '@{'
  // - contains control characters or chars in: space, ~, ^, :, ?, *, [, \
  // - starts with or ends with '/'
  // - ends with '.lock'
  // - ends with '.'
  if (
    trimmed.includes('..') ||
    trimmed.includes('@{') ||
    /[\x00-\x1F\x7F ~^:?*[\\]/.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.endsWith('/') ||
    trimmed.endsWith('.lock') ||
    trimmed.endsWith('.')
  ) {
    return false;
  }

  return true;
}

// Internal GitHub API response shapes
interface RawRepoResponse {
  owner?: { login?: string };
  name?: string;
  full_name?: string;
  default_branch?: string | null;
  description?: string | null;
  private?: boolean;
  fork?: boolean;
  stargazers_count?: number;
  open_issues_count?: number;
  license?: { spdx_id?: string; name?: string } | null;
}

interface RawIssueUser {
  login?: string;
  avatar_url?: string;
}

interface RawIssueLabel {
  name?: string;
  description?: string;
  color?: string;
}

interface RawIssueResponse {
  number?: number;
  title?: string;
  body?: string | null;
  state?: string;
  created_at?: string;
  updated_at?: string;
  user?: RawIssueUser;
  assignee?: RawIssueUser | null;
  assignees?: RawIssueUser[];
  labels?: Array<RawIssueLabel | string>;
  comments?: number;
  pull_request?: Record<string, unknown>;
}

interface RawCommentResponse {
  id?: number;
  body?: string | null;
  user?: RawIssueUser;
  created_at?: string;
}

interface RawContentResponse {
  path?: string;
  content?: string;
  encoding?: string;
}

interface RawTreeItem {
  path?: string;
  type?: string;
  size?: number;
}

interface RawTreeResponse {
  tree?: RawTreeItem[];
  truncated?: boolean;
}

/**
 * Custom error class representing GitHub API and upstream ingestion failures.
 */
export class GitHubApiError extends Error {
  readonly code: IngestionErrorCode;
  readonly status: number;
  readonly details?: string;

  constructor(code: IngestionErrorCode, message: string, status: number, details?: string) {
    super(message);
    this.name = 'GitHubApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  toIngestionError(): IngestionError {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      details: this.details,
    };
  }
}

export interface GitHubClientOptions {
  token?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/**
 * Lightweight, secure GitHub REST API client using native fetch.
 */
export class GitHubClient {
  private readonly token?: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options?: GitHubClientOptions) {
    // Priority: Explicit token > Server-side environment variable
    const envToken = typeof process !== 'undefined' ? process.env.GITHUB_TOKEN : undefined;
    this.token = options?.token || envToken || undefined;
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
  }

  /**
   * Internal helper to execute HTTP requests against fixed api.github.com host.
   * Enforces redirect safety: rejects any outbound redirect that attempts to leave api.github.com.
   */
  private async request<T>(
    endpointPath: string,
    options: { allow404?: boolean; redirectCount?: number } = {}
  ): Promise<{ data: T | null; status: number }> {
    // Defensive check: Outbound URLs MUST be rooted at fixed GITHUB_API_BASE
    const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    const targetUrl = new URL(cleanPath, GITHUB_API_BASE);

    // Verify origin didn't escape during resolution
    if (targetUrl.origin !== GITHUB_API_BASE) {
      throw new GitHubApiError(
        'UPSTREAM_ERROR',
        `Security violation: Target URL "${targetUrl.origin}" escaped fixed API base.`,
        502
      );
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'FirstPR-Ingestion-Engine',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let response: Response;
    try {
      response = await this.fetchFn(targetUrl.toString(), {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: 'manual',
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
          throw new GitHubApiError(
            'UPSTREAM_TIMEOUT',
            `GitHub API request timed out after ${this.timeoutMs}ms`,
            504
          );
        }
        throw new GitHubApiError(
          'UPSTREAM_ERROR',
          `Network failure reaching GitHub API: ${err.message}`,
          502
        );
      }
      throw new GitHubApiError('UPSTREAM_ERROR', 'Unknown network failure', 502);
    }

    // Handle HTTP Redirects (301, 302, 307, 308) safely
    if (
      response.status === 301 ||
      response.status === 302 ||
      response.status === 307 ||
      response.status === 308
    ) {
      const location = response.headers.get('location');
      if (!location) {
        throw new GitHubApiError(
          'UPSTREAM_ERROR',
          `GitHub API redirected with status ${response.status} but provided no Location header.`,
          502
        );
      }

      let redirectUrl: URL;
      try {
        redirectUrl = new URL(location, GITHUB_API_BASE);
      } catch {
        throw new GitHubApiError(
          'UPSTREAM_ERROR',
          `Malformed redirect Location header received: ${location}`,
          502
        );
      }

      // STRICT SECURITY CHECK: Outbound requests cannot escape the fixed API hostname
      if (redirectUrl.origin !== GITHUB_API_BASE) {
        throw new GitHubApiError(
          'UPSTREAM_ERROR',
          `Security violation: Outbound redirect to external host "${redirectUrl.origin}" is blocked.`,
          502
        );
      }

      const redirectCount = (options.redirectCount ?? 0) + 1;
      if (redirectCount > MAX_REDIRECT_HOPS) {
        throw new GitHubApiError(
          'UPSTREAM_ERROR',
          'Too many redirects encountered from GitHub API.',
          502
        );
      }

      // Follow the safe same-origin redirect
      return this.request<T>(`${redirectUrl.pathname}${redirectUrl.search}`, {
        ...options,
        redirectCount,
      });
    }

    // Handle 404 specifically when caller allows it (e.g. README/CONTRIBUTING check)
    if (response.status === 404 && options.allow404) {
      return { data: null, status: 404 };
    }

    if (!response.ok) {
      await this.handleHttpError(response);
    }

    try {
      const data = (await response.json()) as T;
      return { data, status: response.status };
    } catch (jsonErr: unknown) {
      throw new GitHubApiError(
        'UPSTREAM_ERROR',
        `Failed to parse GitHub API response as JSON: ${jsonErr instanceof Error ? jsonErr.message : 'Invalid JSON'}`,
        502
      );
    }
  }

  /**
   * Translates non-OK HTTP status codes into typed GitHubApiError instances.
   */
  private async handleHttpError(response: Response): Promise<never> {
    const status = response.status;
    const message = `GitHub API error (HTTP ${status})`;
    let details: string | undefined;

    try {
      const body = (await response.json()) as { message?: string } | null;
      if (body && typeof body.message === 'string') {
        details = body.message;
      }
    } catch {
      // Body may not be JSON
    }

    if (status === 404) {
      throw new GitHubApiError(
        'NOT_FOUND',
        'Repository or issue not found on GitHub. Verify the URL and repository visibility.',
        404,
        details
      );
    }

    if (status === 401) {
      throw new GitHubApiError(
        'UNAUTHORIZED',
        'Authentication failed with GitHub API. Verify your server GITHUB_TOKEN.',
        401,
        details
      );
    }

    if (status === 403 || status === 429) {
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      const isRateLimited =
        rateLimitRemaining === '0' ||
        status === 429 ||
        Boolean(details && details.toLowerCase().includes('rate limit'));

      if (isRateLimited) {
        throw new GitHubApiError(
          'FORBIDDEN_OR_RATE_LIMITED',
          'GitHub API rate limit exceeded. Please configure a GITHUB_TOKEN or wait before retrying.',
          429,
          details
        );
      }

      throw new GitHubApiError(
        'FORBIDDEN_OR_RATE_LIMITED',
        'Access to GitHub resource is forbidden. The repository may be private or restricted.',
        403,
        details
      );
    }

    if (status >= 500) {
      throw new GitHubApiError(
        'UPSTREAM_ERROR',
        'GitHub service is currently unavailable or returned a server error.',
        502,
        details
      );
    }

    throw new GitHubApiError(
      'UPSTREAM_ERROR',
      `${message}${details ? `: ${details}` : ''}`,
      502,
      details
    );
  }

  /**
   * Fetches repository metadata including default branch.
   * Does NOT silently fall back to 'main' if default_branch is absent or invalid.
   */
  async fetchRepository(owner: string, repo: string): Promise<GitHubRepositoryMetadata> {
    const { data } = await this.request<RawRepoResponse>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
    );

    if (!data) {
      throw new GitHubApiError('NOT_FOUND', `Repository ${owner}/${repo} was not found.`, 404);
    }

    const rawDefaultBranch = data.default_branch;
    const defaultBranch =
      typeof rawDefaultBranch === 'string' && isValidGitBranchName(rawDefaultBranch)
        ? rawDefaultBranch.trim()
        : null;

    return {
      owner: data.owner?.login ?? owner,
      name: data.name ?? repo,
      fullName: data.full_name ?? `${owner}/${repo}`,
      defaultBranch,
      description: data.description ?? null,
      isPrivate: Boolean(data.private),
      isFork: Boolean(data.fork),
      stargazersCount: Number(data.stargazers_count ?? 0),
      openIssuesCount: Number(data.open_issues_count ?? 0),
      license: data.license?.spdx_id || data.license?.name || null,
    };
  }

  /**
   * Fetches issue details. Rejects if issue is actually a pull request.
   */
  async fetchIssue(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<GitHubIssueMetadata> {
    const { data } = await this.request<RawIssueResponse>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`
    );

    if (!data) {
      throw new GitHubApiError('NOT_FOUND', `Issue #${issueNumber} not found in ${owner}/${repo}.`, 404);
    }

    // GitHub's issues API returns a `pull_request` key if the item is a PR
    const isPullRequest = Boolean(data.pull_request);
    if (isPullRequest) {
      throw new GitHubApiError(
        'PULL_REQUEST_UNSUPPORTED',
        `Item #${issueNumber} in ${owner}/${repo} is a pull request, not an issue. FirstPR operates on GitHub issues.`,
        400
      );
    }

    const assignees: Array<{ login: string; avatarUrl?: string }> = Array.isArray(data.assignees)
      ? data.assignees
          .filter((a): a is RawIssueUser => Boolean(a && a.login))
          .map((a) => ({
            login: a.login as string,
            avatarUrl: a.avatar_url,
          }))
      : data.assignee && data.assignee.login
        ? [{ login: data.assignee.login, avatarUrl: data.assignee.avatar_url }]
        : [];

    const labels: Array<{ name: string; description?: string; color?: string }> = Array.isArray(
      data.labels
    )
      ? data.labels.map((l) => {
          if (typeof l === 'string') {
            return { name: l };
          }
          return {
            name: l.name || '',
            description: l.description,
            color: l.color,
          };
        })
      : [];

    return {
      issueNumber: Number(data.number ?? issueNumber),
      canonicalUrl: `https://github.com/${owner}/${repo}/issues/${issueNumber}`,
      title: data.title ?? '',
      body: data.body ?? '',
      state: data.state === 'closed' ? 'closed' : 'open',
      createdAt: data.created_at ?? new Date().toISOString(),
      updatedAt: data.updated_at ?? new Date().toISOString(),
      author: {
        login: data.user?.login ?? 'unknown',
        avatarUrl: data.user?.avatar_url,
      },
      assignees,
      labels,
      commentsCount: Number(data.comments ?? 0),
      isPullRequest: false,
    };
  }

  /**
   * Fetches at most 5 comments in chronological order.
   */
  async fetchComments(
    owner: string,
    repo: string,
    issueNumber: number,
    limit: number = 5
  ): Promise<GitHubCommentItem[]> {
    const boundedLimit = Math.max(1, Math.min(limit, 5));
    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments?per_page=${boundedLimit}&sort=created&direction=asc`;

    const { data } = await this.request<RawCommentResponse[]>(endpoint);
    if (!Array.isArray(data)) {
      return [];
    }

    return data.slice(0, boundedLimit).map((c) => {
      const rawBody = c.body ?? '';
      const isTruncated = rawBody.length > MAX_COMMENT_CHARS;
      const body = isTruncated ? rawBody.slice(0, MAX_COMMENT_CHARS) : rawBody;

      return {
        id: Number(c.id ?? 0),
        author: c.user?.login ?? 'unknown',
        body,
        createdAt: c.created_at ?? new Date().toISOString(),
        isTruncated,
      };
    });
  }

  /**
   * Fetches README content if present.
   */
  async fetchReadme(owner: string, repo: string): Promise<DocumentContentStatus> {
    const { data, status } = await this.request<RawContentResponse>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
      { allow404: true }
    );

    if (status === 404 || !data) {
      return { status: 'missing' };
    }

    return this.decodeDocumentContent(data.content, data.path || 'README.md', MAX_README_CHARS);
  }

  /**
   * Fetches CONTRIBUTING guidelines by checking common location variants.
   */
  async fetchContributing(owner: string, repo: string): Promise<DocumentContentStatus> {
    for (const candidatePath of CONTRIBUTING_CANDIDATE_PATHS) {
      const { data, status } = await this.request<RawContentResponse>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${candidatePath}`,
        { allow404: true }
      );

      if (status === 200 && data && data.content) {
        return this.decodeDocumentContent(data.content, data.path || candidatePath, MAX_CONTRIBUTING_CHARS);
      }
    }

    return { status: 'missing' };
  }

  /**
   * Fetches bounded repository file tree for the default branch.
   * If branch is null or invalid, returns empty bounded tree.
   */
  async fetchFileTree(
    owner: string,
    repo: string,
    defaultBranch: string | null
  ): Promise<BoundedFileTree> {
    if (!defaultBranch || !isValidGitBranchName(defaultBranch)) {
      return {
        totalFilesFound: 0,
        retainedPaths: [],
        isTruncated: false,
      };
    }

    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`;

    const { data, status } = await this.request<RawTreeResponse>(endpoint, { allow404: true });

    if (status === 404 || !data || !Array.isArray(data.tree)) {
      return {
        totalFilesFound: 0,
        retainedPaths: [],
        isTruncated: false,
      };
    }

    // Filter to blob (files) only and exclude noise/vendor/bloat
    const candidateFiles = data.tree
      .filter((item): item is RawTreeItem & { path: string } => item.type === 'blob' && typeof item.path === 'string')
      .map((item) => item.path)
      .filter((filePath: string) => !TREE_IGNORE_PATTERNS.some((pattern) => pattern.test(filePath)));

    const totalFilesFound = candidateFiles.length;
    const isTruncated = totalFilesFound > MAX_RETAINED_FILE_PATHS || Boolean(data.truncated);
    const retainedPaths = candidateFiles.slice(0, MAX_RETAINED_FILE_PATHS);

    return {
      totalFilesFound,
      retainedPaths,
      isTruncated,
    };
  }

  /**
   * Decodes Base64 file content safely with length bounding.
   */
  private decodeDocumentContent(
    base64Content: string | undefined,
    filePath: string,
    maxChars: number
  ): DocumentContentStatus {
    if (!base64Content || typeof base64Content !== 'string') {
      return { status: 'missing' };
    }

    try {
      // GitHub API base64 strings contain \n formatting
      const cleanBase64 = base64Content.replace(/\s/g, '');
      const rawText = Buffer.from(cleanBase64, 'base64').toString('utf-8');
      const isTruncated = rawText.length > maxChars;
      const content = isTruncated ? rawText.slice(0, maxChars) : rawText;

      return {
        status: 'present',
        path: filePath,
        content,
        isTruncated,
        characterCount: rawText.length,
      };
    } catch {
      return { status: 'missing' };
    }
  }
}
