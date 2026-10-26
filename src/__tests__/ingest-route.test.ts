import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../app/api/ingest/route';
import { MAX_REQUEST_BODY_BYTES } from '../lib/github/client';
import { NextRequest } from 'next/server';

describe('POST /api/ingest Route Handler', () => {
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

    return new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers,
      body: payload,
    });
  }

  it('returns 415 when Content-Type header is not application/json', async () => {
    const req = createRequest({ issueUrl: 'https://github.com/owner/repo/issues/1' }, {
      contentType: 'text/plain',
    });
    const res = await POST(req);

    expect(res.status).toBe(415);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(json.data).toBeUndefined();
  });

  it('returns 413 when Content-Length header exceeds MAX_REQUEST_BODY_BYTES', async () => {
    const oversizedLength = (MAX_REQUEST_BODY_BYTES + 100).toString();
    const req = createRequest(
      { issueUrl: 'https://github.com/owner/repo/issues/1' },
      { contentLength: oversizedLength }
    );
    const res = await POST(req);

    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(json.data).toBeUndefined();
  });

  it('returns 413 when raw body payload exceeds MAX_REQUEST_BODY_BYTES', async () => {
    const hugePadding = 'A'.repeat(MAX_REQUEST_BODY_BYTES + 50);
    const oversizedJson = JSON.stringify({
      issueUrl: 'https://github.com/owner/repo/issues/1',
      extra: hugePadding,
    });

    const req = createRequest(null, { rawString: oversizedJson });
    const res = await POST(req);

    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(json.data).toBeUndefined();
  });

  it('returns 400 when request body contains malformed JSON', async () => {
    const req = createRequest(null, { rawString: '{ malformed json: true ' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_REQUEST');
    expect(json.data).toBeUndefined();
  });

  it('returns 400 when issueUrl is missing or invalid type', async () => {
    const req = createRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_URL');
    expect(json.data).toBeUndefined();
  });

  it('returns 400 and NO contribution context when issueUrl is a pull request URL', async () => {
    const req = createRequest({
      issueUrl: 'https://github.com/facebook/react/pull/1234',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_URL');
    expect(json.error.message).toMatch(/pull request URLs are not supported/i);
    // Explicit assertion: No context data is returned
    expect(json.data).toBeUndefined();
  });

  it('returns 400 and NO contribution context when GitHub issue response contains a pull_request field', async () => {
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

      // GitHub returns issue object with pull_request attribute
      if (urlStr.endsWith('/repos/facebook/react/issues/500')) {
        return new Response(
          JSON.stringify({
            number: 500,
            title: 'A pull request opened through the issue tracker',
            pull_request: {
              url: 'https://api.github.com/repos/facebook/react/pulls/500',
              html_url: 'https://github.com/facebook/react/pull/500',
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
    expect(json.error.message).toMatch(/pull request/i);
    // Explicit assertion: No contribution context is returned
    expect(json.data).toBeUndefined();
  });

  it('returns 200 with structured context on successful ingestion', async () => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();

      if (urlStr.endsWith('/repos/facebook/react')) {
        return new Response(
          JSON.stringify({
            owner: { login: 'facebook' },
            name: 'react',
            full_name: 'facebook/react',
            default_branch: 'main',
            description: 'The library for web and native user interfaces',
            private: false,
          }),
          { status: 200 }
        );
      }

      if (urlStr.endsWith('/repos/facebook/react/issues/100')) {
        return new Response(
          JSON.stringify({
            number: 100,
            title: 'Bug report',
            body: 'Component unmount issue',
            state: 'open',
            user: { login: 'tester' },
            assignees: [],
            labels: [],
            comments: 0,
          }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/issues/100/comments')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (urlStr.endsWith('/readme')) {
        return new Response(
          JSON.stringify({
            path: 'README.md',
            content: Buffer.from('# React', 'utf-8').toString('base64'),
          }),
          { status: 200 }
        );
      }

      if (urlStr.endsWith('/contents/CONTRIBUTING.md')) {
        return new Response(
          JSON.stringify({
            path: 'CONTRIBUTING.md',
            content: Buffer.from('# Contributing', 'utf-8').toString('base64'),
          }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/git/trees/main')) {
        return new Response(
          JSON.stringify({
            tree: [{ path: 'packages/react/index.js', type: 'blob' }],
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
    expect(json.data.repository.fullName).toBe('facebook/react');
    expect(json.data.issue.title).toBe('Bug report');
    expect(json.data.readme.content).toBe('# React');
    expect(json.data.contributing.content).toBe('# Contributing');
  });

  it('propagates upstream 404 when repository does not exist', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 })
    );

    const req = createRequest({
      issueUrl: 'https://github.com/owner/missing/issues/1',
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('NOT_FOUND');
    expect(json.data).toBeUndefined();
  });
});
