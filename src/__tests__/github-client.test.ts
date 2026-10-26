import { describe, it, expect, vi } from 'vitest';
import {
  GitHubClient,
  GitHubApiError,
  GITHUB_API_BASE,
  MAX_README_CHARS,
  MAX_RETAINED_FILE_PATHS,
} from '../lib/github/client';

describe('GitHubClient', () => {
  it('strictly targets https://api.github.com and includes required headers', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};

    const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return new Response(
        JSON.stringify({
          owner: { login: 'facebook' },
          name: 'react',
          full_name: 'facebook/react',
          default_branch: 'main',
          private: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/vnd.github+json' } }
      );
    });

    const client = new GitHubClient({
      token: 'test-secret-token',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const repo = await client.fetchRepository('facebook', 'react');

    expect(capturedUrl).toBe(`${GITHUB_API_BASE}/repos/facebook/react`);
    expect(capturedUrl.startsWith(GITHUB_API_BASE)).toBe(true);
    expect(capturedHeaders['Accept']).toBe('application/vnd.github+json');
    expect(capturedHeaders['User-Agent']).toBe('FirstPR-Ingestion-Engine');
    expect(capturedHeaders['Authorization']).toBe('Bearer test-secret-token');

    // Confirm token is NOT in repo metadata
    expect(JSON.stringify(repo)).not.toContain('test-secret-token');
  });

  it('correctly parses repository metadata with valid default branch', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          owner: { login: 'facebook' },
          name: 'react',
          full_name: 'facebook/react',
          default_branch: 'main',
          description: 'A declarative library for building user interfaces',
          private: false,
          fork: false,
          stargazers_count: 220000,
          open_issues_count: 1200,
          license: { spdx_id: 'MIT' },
        }),
        { status: 200 }
      )
    );

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });
    const repo = await client.fetchRepository('facebook', 'react');

    expect(repo.owner).toBe('facebook');
    expect(repo.name).toBe('react');
    expect(repo.fullName).toBe('facebook/react');
    expect(repo.defaultBranch).toBe('main');
    expect(repo.stargazersCount).toBe(220000);
    expect(repo.license).toBe('MIT');
  });

  it('does not silently fall back to main when default branch is missing', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          owner: { login: 'owner' },
          name: 'empty-branch-repo',
          full_name: 'owner/empty-branch-repo',
          default_branch: null,
        }),
        { status: 200 }
      )
    );

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });
    const repo = await client.fetchRepository('owner', 'empty-branch-repo');

    expect(repo.defaultBranch).toBeNull();
    expect(repo.defaultBranch).not.toBe('main');
  });

  it('rejects invalid default branch names and returns null instead of falling back', async () => {
    const invalidBranches = ['', '   ', '../../dangerous', 'feature/bad space', 'head~1'];

    for (const invalidBranch of invalidBranches) {
      const mockFetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            owner: { login: 'owner' },
            name: 'test-repo',
            full_name: 'owner/test-repo',
            default_branch: invalidBranch,
          }),
          { status: 200 }
        )
      );

      const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });
      const repo = await client.fetchRepository('owner', 'test-repo');
      expect(repo.defaultBranch).toBeNull();
    }
  });

  it('blocks redirects to external hosts', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'https://attacker.com/evil-endpoint' },
      })
    );

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });

    await expect(client.fetchRepository('owner', 'repo')).rejects.toThrow(GitHubApiError);
    await expect(client.fetchRepository('owner', 'repo')).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
      status: 502,
    });
  });

  it('blocks redirects to non-HTTPS protocols', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(null, {
        status: 301,
        headers: { location: 'http://api.github.com/repos/owner/repo' },
      })
    );

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });

    await expect(client.fetchRepository('owner', 'repo')).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
      status: 502,
    });
  });

  it('safely follows same-origin redirects within api.github.com', async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      callCount++;
      const urlStr = url.toString();
      if (urlStr.endsWith('/repos/old-owner/old-repo')) {
        return new Response(null, {
          status: 301,
          headers: { location: 'https://api.github.com/repos/new-owner/new-repo' },
        });
      }
      if (urlStr.endsWith('/repos/new-owner/new-repo')) {
        return new Response(
          JSON.stringify({
            owner: { login: 'new-owner' },
            name: 'new-repo',
            full_name: 'new-owner/new-repo',
            default_branch: 'main',
          }),
          { status: 200 }
        );
      }
      return new Response('Not Found', { status: 404 });
    });

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });
    const repo = await client.fetchRepository('old-owner', 'old-repo');

    expect(repo.fullName).toBe('new-owner/new-repo');
    expect(callCount).toBe(2);
  });

  it('blocks redirect loops exceeding maximum hops', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'https://api.github.com/repos/owner/repo-loop' },
      })
    );

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });

    await expect(client.fetchRepository('owner', 'repo-loop')).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
      status: 502,
    });
  });

  it('throws PULL_REQUEST_UNSUPPORTED when issue payload contains pull_request object', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          number: 123,
          title: 'A pull request mistakenly opened as issue',
          pull_request: {
            url: 'https://api.github.com/repos/owner/repo/pulls/123',
          },
        }),
        { status: 200 }
      )
    );

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });

    await expect(client.fetchIssue('owner', 'repo', 123)).rejects.toThrow(GitHubApiError);
    await expect(client.fetchIssue('owner', 'repo', 123)).rejects.toMatchObject({
      code: 'PULL_REQUEST_UNSUPPORTED',
      status: 400,
    });
  });

  it('handles 404 repository or issue not found', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 })
    );

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });

    await expect(client.fetchRepository('nonexistent', 'repo')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('handles 401 unauthorized errors', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 })
    );

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });

    await expect(client.fetchRepository('owner', 'repo')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401,
    });
  });

  it('handles 403 / 429 rate limit exceeded', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ message: 'API rate limit exceeded for user' }),
        {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0' },
        }
      )
    );

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });

    await expect(client.fetchRepository('owner', 'repo')).rejects.toMatchObject({
      code: 'FORBIDDEN_OR_RATE_LIMITED',
      status: 429,
    });
  });

  it('handles network timeouts gracefully', async () => {
    const mockFetch = vi.fn(async () => {
      const err = new Error('The operation was aborted');
      err.name = 'TimeoutError';
      throw err;
    });

    const client = new GitHubClient({
      fetchFn: mockFetch as unknown as typeof fetch,
      timeoutMs: 100,
    });

    await expect(client.fetchRepository('owner', 'repo')).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
      status: 504,
    });
  });

  it('handles malformed JSON upstream responses', async () => {
    const mockFetch = vi.fn(async () =>
      new Response('<html>502 Bad Gateway</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });

    await expect(client.fetchRepository('owner', 'repo')).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
      status: 502,
    });
  });

  it('fetches and decodes README base64 content with truncation limits', async () => {
    // Generate content exceeding limit
    const largeContent = 'A'.repeat(MAX_README_CHARS + 500);
    const base64 = Buffer.from(largeContent, 'utf-8').toString('base64');

    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          path: 'README.md',
          content: base64,
          encoding: 'base64',
        }),
        { status: 200 }
      )
    );

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });
    const readme = await client.fetchReadme('owner', 'repo');

    expect(readme.status).toBe('present');
    expect(readme.path).toBe('README.md');
    expect(readme.isTruncated).toBe(true);
    expect(readme.content?.length).toBe(MAX_README_CHARS);
  });

  it('returns missing status when README is not found (404)', async () => {
    const mockFetch = vi.fn(async () => new Response('Not Found', { status: 404 }));

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });
    const readme = await client.fetchReadme('owner', 'repo');

    expect(readme.status).toBe('missing');
    expect(readme.content).toBeUndefined();
  });

  it('fetches CONTRIBUTING from candidate fallback paths', async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      callCount++;
      const urlStr = url.toString();
      // First attempt CONTRIBUTING.md returns 404
      if (urlStr.endsWith('/contents/CONTRIBUTING.md')) {
        return new Response('Not Found', { status: 404 });
      }
      // Second attempt .github/CONTRIBUTING.md returns 200
      if (urlStr.endsWith('/contents/.github/CONTRIBUTING.md')) {
        return new Response(
          JSON.stringify({
            path: '.github/CONTRIBUTING.md',
            content: Buffer.from('# Contributing Guide', 'utf-8').toString('base64'),
          }),
          { status: 200 }
        );
      }
      return new Response('Not Found', { status: 404 });
    });

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });
    const contributing = await client.fetchContributing('owner', 'repo');

    expect(contributing.status).toBe('present');
    expect(contributing.path).toBe('.github/CONTRIBUTING.md');
    expect(contributing.content).toBe('# Contributing Guide');
    expect(callCount).toBe(2);
  });

  it('filters file tree and caps retained paths', async () => {
    // Generate 150 items with some vendor and build files
    const mockTreeItems: Array<{ path: string; type: string }> = [];
    for (let i = 1; i <= 150; i++) {
      mockTreeItems.push({
        path: `src/component_${i}.tsx`,
        type: 'blob',
      });
    }
    // Add noise items that should be excluded
    mockTreeItems.push({ path: 'node_modules/pkg/index.js', type: 'blob' });
    mockTreeItems.push({ path: '.git/HEAD', type: 'blob' });
    mockTreeItems.push({ path: 'package-lock.json', type: 'blob' });
    mockTreeItems.push({ path: 'logo.png', type: 'blob' });
    mockTreeItems.push({ path: 'src', type: 'tree' }); // tree, not blob

    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          tree: mockTreeItems,
          truncated: false,
        }),
        { status: 200 }
      )
    );

    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });
    const tree = await client.fetchFileTree('owner', 'repo', 'main');

    expect(tree.totalFilesFound).toBe(150);
    expect(tree.isTruncated).toBe(true);
    expect(tree.retainedPaths.length).toBe(MAX_RETAINED_FILE_PATHS);
    // Ensure noise paths were filtered
    expect(tree.retainedPaths).not.toContain('node_modules/pkg/index.js');
    expect(tree.retainedPaths).not.toContain('package-lock.json');
    expect(tree.retainedPaths).not.toContain('logo.png');
  });

  it('returns empty file tree when default branch is null', async () => {
    const mockFetch = vi.fn();
    const client = new GitHubClient({ fetchFn: mockFetch as unknown as typeof fetch });

    const tree = await client.fetchFileTree('owner', 'repo', null);
    expect(tree.totalFilesFound).toBe(0);
    expect(tree.retainedPaths).toEqual([]);
    expect(tree.isTruncated).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
