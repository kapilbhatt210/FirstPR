import { NextRequest, NextResponse } from 'next/server';
import { issueInputSchema } from '@/lib/validation/issue';
import { ingestGitHubIssue } from '@/lib/github/context-service';
import { MAX_REQUEST_BODY_BYTES } from '@/lib/github/client';

/**
 * POST /api/ingest
 *
 * Ingestion endpoint accepting a GitHub issue URL, validating the input,
 * and fetching bounded repository & issue context for future contribution readiness.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Enforce JSON Content-Type
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Content-Type header must be application/json.',
            status: 415,
          },
        },
        { status: 415 }
      );
    }

    // 2. Reject oversized requests based on Content-Length header if present
    const contentLengthHeader = request.headers.get('content-length');
    if (contentLengthHeader) {
      const parsedLength = parseInt(contentLengthHeader, 10);
      if (!isNaN(parsedLength) && parsedLength > MAX_REQUEST_BODY_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: `Request body exceeds maximum allowed size of ${MAX_REQUEST_BODY_BYTES} bytes.`,
              status: 413,
            },
          },
          { status: 413 }
        );
      }
    }

    // 3. Read body with byte size enforcement
    let rawText: string;
    try {
      rawText = await request.text();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Unable to read request body stream.',
            status: 400,
          },
        },
        { status: 400 }
      );
    }

    if (rawText.length > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `Request body exceeds maximum allowed size of ${MAX_REQUEST_BODY_BYTES} bytes.`,
            status: 413,
          },
        },
        { status: 413 }
      );
    }

    // 4. Safe JSON parse
    let body: unknown;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request body must be valid JSON.',
            status: 400,
          },
        },
        { status: 400 }
      );
    }

    // 5. Validate request payload with Zod
    const validation = issueInputSchema.safeParse(body);
    if (!validation.success) {
      const issueMessage =
        validation.error.errors[0]?.message || 'Invalid or missing issueUrl.';
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_URL',
            message: issueMessage,
            status: 400,
          },
        },
        { status: 400 }
      );
    }

    // 6. Ingest issue and repository context
    const result = await ingestGitHubIssue(validation.data.issueUrl);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: result.error.code,
            message: result.error.message,
            status: result.error.status,
            ...(result.error.details ? { details: result.error.details } : {}),
          },
        },
        { status: result.error.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data,
        ...(result.warnings ? { warnings: result.warnings } : {}),
      },
      { status: 200 }
    );
  } catch (unexpectedError: unknown) {
    // Defensive barrier: Never expose internal stack traces or secrets
    const errorMessage =
      unexpectedError instanceof Error
        ? unexpectedError.message
        : 'An internal error occurred while processing the request.';

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected server error occurred.',
          status: 500,
          details: errorMessage,
        },
      },
      { status: 500 }
    );
  }
}
