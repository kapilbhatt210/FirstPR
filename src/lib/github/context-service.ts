import { GitHubClient, GitHubApiError } from './client';
import { parseGitHubIssueUrl } from './url-parser';
import {
  BoundedFileTree,
  DocumentContentStatus,
  GitHubCommentItem,
  GitHubIssueContext,
  IngestionResult,
} from './types';

export interface IngestIssueOptions {
  client?: GitHubClient;
  token?: string;
  timeoutMs?: number;
}

/**
 * Orchestrates the ingestion of a GitHub issue and its surrounding repository context.
 *
 * Implements partial success for secondary documentation:
 * - If CONTRIBUTING.md or README.md are absent, records their missing status gracefully.
 * - If file tree cannot be retrieved, records an empty bounded tree with a diagnostic warning.
 */
export async function ingestGitHubIssue(
  rawIssueUrl: string,
  options?: IngestIssueOptions
): Promise<IngestionResult> {
  // Step 1: Validate and parse issue URL
  const parseResult = parseGitHubIssueUrl(rawIssueUrl);
  if (!parseResult.success) {
    return {
      success: false,
      error: {
        code: 'INVALID_URL',
        message: parseResult.error,
        status: 400,
      },
    };
  }

  const { owner, repo, issueNumber } = parseResult.data;
  const client =
    options?.client ??
    new GitHubClient({
      token: options?.token,
      timeoutMs: options?.timeoutMs,
    });

  const warnings: string[] = [];

  try {
    // Step 2: Fetch primary repository metadata
    const repository = await client.fetchRepository(owner, repo);

    // Step 3: Fetch issue details (throws PULL_REQUEST_UNSUPPORTED if it is a PR)
    const issue = await client.fetchIssue(owner, repo, issueNumber);

    // Step 4: Fetch auxiliary context in parallel with safe error isolation
    const hasValidBranch = Boolean(repository.defaultBranch);
    if (!hasValidBranch) {
      warnings.push(
        'Repository does not specify a valid default branch. File tree retrieval was skipped.'
      );
    }

    const [commentsSettled, readmeSettled, contributingSettled, treeSettled] =
      await Promise.allSettled([
        client.fetchComments(owner, repo, issueNumber, 5),
        client.fetchReadme(owner, repo),
        client.fetchContributing(owner, repo),
        hasValidBranch
          ? client.fetchFileTree(owner, repo, repository.defaultBranch)
          : Promise.resolve({ totalFilesFound: 0, retainedPaths: [], isTruncated: false }),
      ]);

    // Process comments
    let comments: GitHubCommentItem[] = [];
    if (commentsSettled.status === 'fulfilled') {
      comments = commentsSettled.value;
    } else {
      warnings.push(`Unable to retrieve issue comments: ${commentsSettled.reason?.message ?? 'Unknown error'}`);
    }

    // Process README
    let readme: DocumentContentStatus = { status: 'missing' };
    if (readmeSettled.status === 'fulfilled') {
      readme = readmeSettled.value;
      if (readme.status === 'missing') {
        warnings.push('README.md was not found in the repository.');
      }
    } else {
      warnings.push(`Unable to check README.md: ${readmeSettled.reason?.message ?? 'Unknown error'}`);
    }

    // Process CONTRIBUTING guidelines
    let contributing: DocumentContentStatus = { status: 'missing' };
    if (contributingSettled.status === 'fulfilled') {
      contributing = contributingSettled.value;
      if (contributing.status === 'missing') {
        warnings.push('CONTRIBUTING guide was not found in standard repository locations.');
      }
    } else {
      warnings.push(
        `Unable to check CONTRIBUTING guide: ${contributingSettled.reason?.message ?? 'Unknown error'}`
      );
    }

    // Process File Tree
    let fileTree: BoundedFileTree = {
      totalFilesFound: 0,
      retainedPaths: [],
      isTruncated: false,
    };
    if (treeSettled.status === 'fulfilled') {
      fileTree = treeSettled.value;
    } else {
      warnings.push(`Unable to retrieve repository file tree: ${treeSettled.reason?.message ?? 'Unknown error'}`);
    }

    // Assemble completed context
    const data: GitHubIssueContext = {
      repository,
      issue,
      comments,
      readme,
      contributing,
      fileTree,
      fetchedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err: unknown) {
    if (err instanceof GitHubApiError) {
      return {
        success: false,
        error: err.toIngestionError(),
      };
    }

    const message = err instanceof Error ? err.message : 'An unexpected error occurred during ingestion';
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
        status: 500,
      },
    };
  }
}
