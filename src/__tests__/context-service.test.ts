import { describe, it, expect, vi } from 'vitest';
import { ingestGitHubIssue } from '../lib/github/context-service';
import { GitHubClient } from '../lib/github/client';

describe('GitHub Context Ingestion Service', () => {
  it('rejects invalid URL format before attempting outbound network calls', async () => {
    const mockFetch = vi.fn();
    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });

    const result = await ingestGitHubIssue('https://gitlab.com/owner/repo/issues/1', { client });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_URL');
      expect(result.error.status).toBe(400);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects pull request URLs with 400', async () => {
    const mockFetch = vi.fn();
    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });

    const result = await ingestGitHubIssue('https://github.com/owner/repo/pull/50', { client });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_URL');
      expect(result.error.message).toMatch(/pull request/i);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('completes successful full ingestion and structures context correctly', async () => {
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();

      if (urlStr.endsWith('/repos/owner/repo')) {
        return new Response(
          JSON.stringify({
            owner: { login: 'owner' },
            name: 'repo',
            full_name: 'owner/repo',
            default_branch: 'main',
            description: 'Sample open source repository',
            private: false,
            fork: false,
            stargazers_count: 500,
            open_issues_count: 10,
            license: { spdx_id: 'Apache-2.0' },
          }),
          { status: 200 }
        );
      }

      if (urlStr.endsWith('/repos/owner/repo/issues/42')) {
        return new Response(
          JSON.stringify({
            number: 42,
            title: 'Fix typo in documentation',
            body: 'There is a typo on the front page.',
            state: 'open',
            user: { login: 'reporter1' },
            assignees: [{ login: 'dev1' }],
            labels: [{ name: 'good first issue' }],
            comments: 2,
            created_at: '2026-10-01T10:00:00Z',
            updated_at: '2026-10-01T12:00:00Z',
          }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/issues/42/comments')) {
        return new Response(
          JSON.stringify([
            { id: 1, user: { login: 'helper' }, body: 'I can reproduce.', created_at: '2026-10-01T11:00:00Z' },
          ]),
          { status: 200 }
        );
      }

      if (urlStr.endsWith('/repos/owner/repo/readme')) {
        return new Response(
          JSON.stringify({
            path: 'README.md',
            content: Buffer.from('# Repo Documentation', 'utf-8').toString('base64'),
          }),
          { status: 200 }
        );
      }

      if (urlStr.endsWith('/contents/CONTRIBUTING.md')) {
        return new Response(
          JSON.stringify({
            path: 'CONTRIBUTING.md',
            content: Buffer.from('# Contributing Guide', 'utf-8').toString('base64'),
          }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/git/trees/main')) {
        return new Response(
          JSON.stringify({
            tree: [
              { path: 'src/index.ts', type: 'blob' },
              { path: 'package.json', type: 'blob' },
            ],
            truncated: false,
          }),
          { status: 200 }
        );
      }

      return new Response('Not Found', { status: 404 });
    });

    const client = new GitHubClient({
      token: 'secret-token-12345',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await ingestGitHubIssue('https://github.com/owner/repo/issues/42', { client });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.repository.fullName).toBe('owner/repo');
      expect(result.data.repository.defaultBranch).toBe('main');
      expect(result.data.issue.title).toBe('Fix typo in documentation');
      expect(result.data.issue.assignees[0].login).toBe('dev1');
      expect(result.data.issue.labels[0].name).toBe('good first issue');
      expect(result.data.comments.length).toBe(1);
      expect(result.data.readme.status).toBe('present');
      expect(result.data.contributing.status).toBe('present');
      expect(result.data.fileTree.retainedPaths).toEqual(['src/index.ts', 'package.json']);

      // Ensure secrets are not returned anywhere in the data payload
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('secret-token-12345');
    }
  });

  it('handles partial success when CONTRIBUTING and README are missing', async () => {
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();

      if (urlStr.endsWith('/repos/owner/minimal')) {
        return new Response(
          JSON.stringify({
            owner: { login: 'owner' },
            name: 'minimal',
            full_name: 'owner/minimal',
            default_branch: 'main',
          }),
          { status: 200 }
        );
      }

      if (urlStr.endsWith('/repos/owner/minimal/issues/1')) {
        return new Response(
          JSON.stringify({
            number: 1,
            title: 'Initial issue',
            body: 'First issue',
            state: 'open',
          }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/issues/1/comments')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      // README, CONTRIBUTING, and tree return 404
      return new Response('Not Found', { status: 404 });
    });

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });
    const result = await ingestGitHubIssue('https://github.com/owner/minimal/issues/1', { client });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.readme.status).toBe('missing');
      expect(result.data.contributing.status).toBe('missing');
      expect(result.data.fileTree.retainedPaths).toEqual([]);
      // Warnings should document the missing documentation
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes('README'))).toBe(true);
      expect(result.warnings?.some((w) => w.includes('CONTRIBUTING'))).toBe(true);
    }
  });

  it('handles upstream 404 when repository or issue does not exist', async () => {
    const mockFetch = vi.fn(async () => new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }));
    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });

    const result = await ingestGitHubIssue('https://github.com/owner/nonexistent/issues/999', { client });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.status).toBe(404);
    }
  });

  it('handles upstream rate limit errors (403/429)', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0' },
      })
    );
    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });

    const result = await ingestGitHubIssue('https://github.com/owner/repo/issues/1', { client });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN_OR_RATE_LIMITED');
      expect(result.error.status).toBe(429);
    }
  });

  it('handles upstream timeout errors', async () => {
    const mockFetch = vi.fn(async () => {
      const err = new Error('Timeout');
      err.name = 'TimeoutError';
      throw err;
    });
    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });

    const result = await ingestGitHubIssue('https://github.com/owner/repo/issues/1', { client });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.status).toBe(504);
    }
  });

  it('does not assume main branch and emits partial-data warning when defaultBranch is missing', async () => {
    let treeFetchedWithBranch: string | null = null;
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();

      if (urlStr.endsWith('/repos/owner/no-branch')) {
        return new Response(
          JSON.stringify({
            owner: { login: 'owner' },
            name: 'no-branch',
            full_name: 'owner/no-branch',
            default_branch: null,
          }),
          { status: 200 }
        );
      }

      if (urlStr.endsWith('/repos/owner/no-branch/issues/1')) {
        return new Response(
          JSON.stringify({
            number: 1,
            title: 'Sample Issue',
            body: 'Details',
            state: 'open',
          }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/issues/1/comments')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (urlStr.includes('/git/trees/')) {
        treeFetchedWithBranch = urlStr;
        return new Response(JSON.stringify({ tree: [] }), { status: 200 });
      }

      return new Response('Not Found', { status: 404 });
    });

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });
    const result = await ingestGitHubIssue('https://github.com/owner/no-branch/issues/1', { client });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.repository.defaultBranch).toBeNull();
      expect(result.data.fileTree.retainedPaths).toEqual([]);
      expect(result.warnings?.some((w) => w.includes('default branch'))).toBe(true);
      // Ensure file tree was NOT fetched with fallback 'main'
      expect(treeFetchedWithBranch).toBeNull();
    }
  });
});
