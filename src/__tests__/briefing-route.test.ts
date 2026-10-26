import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../app/api/briefing/route';
import { MAX_REQUEST_BODY_BYTES } from '../lib/github/client';
import { NextRequest } from 'next/server';
import { contributionBriefingSchema } from '../lib/briefing/schema';

describe('POST /api/briefing Route Handler', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function createRequest(
    body: unknown,
    options: {
      contentType?: string;
      contentLength?: string;
      rawString?: string;
    } = {}
  ): NextRequest {
    const headers: Record<string, string> = {
      'Content-Type': options.contentType ?? 'application/json',
    };
    if (options.contentLength) {
      headers['Content-Length'] = options.contentLength;
    }

    const payload = options.rawString !== undefined ? options.rawString : JSON.stringify(body);

    return new NextRequest('http://localhost:3000/api/briefing', {
      method: 'POST',
      headers,
      body: payload,
    });
  }

  it('returns 415 when Content-Type header is not application/json', async () => {
    const req = createRequest(
      { issueUrl: 'https://github.com/facebook/react/issues/100' },
      { contentType: 'text/plain' }
    );
    const res = await POST(req);

    expect(res.status).toBe(415);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(json.briefing).toBeUndefined();
  });

  it('returns 413 when Content-Length header exceeds MAX_REQUEST_BODY_BYTES', async () => {
    const oversizedLength = (MAX_REQUEST_BODY_BYTES + 100).toString();
    const req = createRequest(
      { issueUrl: 'https://github.com/facebook/react/issues/100' },
      { contentLength: oversizedLength }
    );
    const res = await POST(req);

    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(json.briefing).toBeUndefined();
  });

  it('returns 413 when raw body payload exceeds MAX_REQUEST_BODY_BYTES', async () => {
    const hugePadding = 'X'.repeat(MAX_REQUEST_BODY_BYTES + 50);
    const oversizedJson = JSON.stringify({
      issueUrl: 'https://github.com/facebook/react/issues/100',
      extra: hugePadding,
    });

    const req = createRequest(null, { rawString: oversizedJson });
    const res = await POST(req);

    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('returns 400 when request body contains malformed JSON', async () => {
    const req = createRequest(null, { rawString: '{ malformed: true, ' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 400 when issueUrl is missing or invalid', async () => {
    const req = createRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_URL');
  });

  it('returns 400 and rejects pull request URLs', async () => {
    const req = createRequest({
      issueUrl: 'https://github.com/facebook/react/pull/500',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_URL');
    expect(json.briefing).toBeUndefined();
  });

  it('returns 400 when GitHub issue contains pull_request field', async () => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();

      if (urlStr.endsWith('/repos/facebook/react')) {
        return new Response(
          JSON.stringify({
            owner: { login: 'facebook' },
            name: 'react',
            full_name: 'facebook/react',
            default_branch: 'main',
          }),
          { status: 200 }
        );
      }

      if (urlStr.endsWith('/repos/facebook/react/issues/500')) {
        return new Response(
          JSON.stringify({
            number: 500,
            title: 'Pull request masquerading as issue',
            pull_request: {
              url: 'https://api.github.com/repos/facebook/react/pulls/500',
            },
          }),
          { status: 200 }
        );
      }

      return new Response('Not Found', { status: 404 });
    });

    const req = createRequest({
      issueUrl: 'https://github.com/facebook/react/issues/500',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('PULL_REQUEST_UNSUPPORTED');
    expect(json.briefing).toBeUndefined();
  });

  it('returns 404 when upstream GitHub issue is not found', async () => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/repos/facebook/react')) {
        return new Response(
          JSON.stringify({
            owner: { login: 'facebook' },
            name: 'react',
            full_name: 'facebook/react',
            default_branch: 'main',
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    });

    const req = createRequest({
      issueUrl: 'https://github.com/facebook/react/issues/999999',
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('NOT_FOUND');
    expect(json.briefing).toBeUndefined();
  });

  it('returns 200 with complete deterministic contribution briefing for valid issue', async () => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();

      if (urlStr.endsWith('/repos/facebook/react')) {
        return new Response(
          JSON.stringify({
            owner: { login: 'facebook' },
            name: 'react',
            full_name: 'facebook/react',
            default_branch: 'main',
            description: 'A JavaScript library for building user interfaces',
            private: false,
            stargazers_count: 220000,
            forks_count: 45000,
            open_issues_count: 800,
          }),
          { status: 200 }
        );
      }

      if (urlStr.endsWith('/repos/facebook/react/issues/100')) {
        return new Response(
          JSON.stringify({
            number: 100,
            title: 'Fix typo in documentation link',
            body: 'Small typo in README.md quickstart section pointing to broken link.',
            state: 'open',
            user: { login: 'first-timer' },
            assignees: [],
            labels: [{ id: 1, name: 'good first issue' }],
            comments: 0,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
            html_url: 'https://github.com/facebook/react/issues/100',
          }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/readme')) {
        return new Response(
          JSON.stringify({
            path: 'README.md',
            content: Buffer.from('# React\nInstall via pnpm install and test via pnpm test.').toString('base64'),
          }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/contents/CONTRIBUTING.md') || urlStr.includes('/contents/.github/CONTRIBUTING.md')) {
        return new Response('Not Found', { status: 404 });
      }

      if (urlStr.includes('/git/trees/main')) {
        return new Response(
          JSON.stringify({
            tree: [
              { path: 'README.md', type: 'blob' },
              { path: 'package.json', type: 'blob' },
              { path: 'src/index.js', type: 'blob' },
            ],
            truncated: false,
          }),
          { status: 200 }
        );
      }

      return new Response('Not Found', { status: 404 });
    });

    const req = createRequest({
      issueUrl: 'https://github.com/facebook/react/issues/100',
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.briefing).toBeDefined();

    // Validate briefing against schema
    const parseResult = contributionBriefingSchema.safeParse(json.briefing);
    expect(parseResult.success).toBe(true);

    expect(json.briefing.difficulty).toBe('beginner');
    expect(json.briefing.candidateFiles.some((f: { path: string }) => f.path === 'README.md')).toBe(true);
    expect(json.briefing.setupCommands[0].command).toBe('pnpm install');
    expect(json.briefing.testCommands[0].command).toBe('pnpm test');
    expect(Array.isArray(json.briefing.warnings)).toBe(true);
    expect(Array.isArray(json.briefing.limitations)).toBe(true);
    expect(json.context).toBeDefined();
    expect(json.context.repository.fullName).toBe('facebook/react');
  });

  it('surfaces explicit warnings in response when issue is closed and assigned', async () => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();

      if (urlStr.endsWith('/repos/facebook/react')) {
        return new Response(
          JSON.stringify({
            owner: { login: 'facebook' },
            name: 'react',
            full_name: 'facebook/react',
            default_branch: 'main',
            description: 'A JavaScript library',
            private: false,
          }),
          { status: 200 }
        );
      }

      if (urlStr.endsWith('/repos/facebook/react/issues/200')) {
        return new Response(
          JSON.stringify({
            number: 200,
            title: 'Resolved layout issue',
            body: 'Old issue that was solved.',
            state: 'closed',
            user: { login: 'someone' },
            assignees: [{ login: 'alice' }],
            labels: [],
            comments: 1,
            html_url: 'https://github.com/facebook/react/issues/200',
          }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/readme') || urlStr.includes('/contents/CONTRIBUTING.md') || urlStr.includes('/contents/.github/CONTRIBUTING.md')) {
        return new Response('Not Found', { status: 404 });
      }

      if (urlStr.includes('/git/trees/main')) {
        return new Response(
          JSON.stringify({
            tree: [{ path: 'package.json', type: 'blob' }],
            truncated: false,
          }),
          { status: 200 }
        );
      }

      return new Response('Not Found', { status: 404 });
    });

    const req = createRequest({
      issueUrl: 'https://github.com/facebook/react/issues/200',
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.briefing.issue.state).toBe('closed');
    expect(json.briefing.issue.assignees).toEqual(['alice']);
    expect(json.briefing.warnings.some((w: string) => w.includes('CLOSED'))).toBe(true);
    expect(json.briefing.warnings.some((w: string) => w.includes('alice'))).toBe(true);
  });
});
