/**
 * GitHub Ingestion Engine Type Definitions.
 *
 * Types for parsing issue URLs, representing raw GitHub API responses,
 * and defining the final ingested contribution context.
 */

/**
 * Validated and parsed representation of a GitHub issue URL.
 */
export interface ParsedGitHubIssueUrl {
  owner: string;
  repo: string;
  issueNumber: number;
  canonicalUrl: string;
}

/**
 * Repository metadata subset needed for contribution context.
 */
export interface GitHubRepositoryMetadata {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string | null;
  description: string | null;
  isPrivate: boolean;
  isFork: boolean;
  stargazersCount: number;
  openIssuesCount: number;
  license: string | null;
}

/**
 * Parsed issue metadata.
 */
export interface GitHubIssueMetadata {
  issueNumber: number;
  canonicalUrl: string;
  title: string;
  body: string;
  state: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  author: {
    login: string;
    avatarUrl?: string;
  };
  assignees: Array<{
    login: string;
    avatarUrl?: string;
  }>;
  labels: Array<{
    name: string;
    description?: string;
    color?: string;
  }>;
  commentsCount: number;
  isPullRequest: boolean;
}

/**
 * Issue comment item (at most 5 chronological comments).
 */
export interface GitHubCommentItem {
  id: number;
  author: string;
  body: string;
  createdAt: string;
  isTruncated: boolean;
}

/**
 * File content status for README or CONTRIBUTING.
 */
export interface DocumentContentStatus {
  status: 'present' | 'missing';
  path?: string;
  content?: string;
  isTruncated?: boolean;
  characterCount?: number;
}

/**
 * Bounded file tree for repository navigation.
 */
export interface BoundedFileTree {
  totalFilesFound: number;
  retainedPaths: string[];
  isTruncated: boolean;
}

/**
 * Complete structured GitHub issue context returned to callers.
 */
export interface GitHubIssueContext {
  repository: GitHubRepositoryMetadata;
  issue: GitHubIssueMetadata;
  comments: GitHubCommentItem[];
  readme: DocumentContentStatus;
  contributing: DocumentContentStatus;
  fileTree: BoundedFileTree;
  fetchedAt: string;
}

/**
 * Standard error codes for ingestion engine.
 */
export type IngestionErrorCode =
  | 'INVALID_URL'
  | 'PULL_REQUEST_UNSUPPORTED'
  | 'INVALID_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN_OR_RATE_LIMITED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

/**
 * Standard error shape returned by the ingestion service and API route.
 */
export interface IngestionError {
  code: IngestionErrorCode;
  message: string;
  status: number;
  details?: string;
}

/**
 * Discriminated union result for ingestion operations.
 */
export type IngestionResult =
  | {
      success: true;
      data: GitHubIssueContext;
      warnings?: string[];
    }
  | {
      success: false;
      error: IngestionError;
    };
