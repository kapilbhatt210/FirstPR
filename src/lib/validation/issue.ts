import { z } from 'zod';
import { parseGitHubIssueUrl } from '../github/url-parser';
import { ParsedGitHubIssueUrl } from '../github/types';

/**
 * Zod schema that validates a string as a strict GitHub issue URL.
 */
export const issueUrlStringSchema = z
  .string({
    required_error: 'issueUrl is required',
    invalid_type_error: 'issueUrl must be a string',
  })
  .trim()
  .min(1, 'issueUrl cannot be empty')
  .superRefine((val, ctx) => {
    const result = parseGitHubIssueUrl(val);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error,
      });
    }
  });

/**
 * Request body schema for issue ingestion endpoint.
 */
export const issueInputSchema = z.object({
  issueUrl: issueUrlStringSchema,
  enableAi: z.boolean().optional(),
});

export type IssueInput = z.infer<typeof issueInputSchema>;

/**
 * Zod schema that transforms a validated issue URL string into a ParsedGitHubIssueUrl object.
 */
export const parsedIssueInputSchema = z.object({
  issueUrl: issueUrlStringSchema.transform((val): ParsedGitHubIssueUrl => {
    const result = parseGitHubIssueUrl(val);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }),
});

export type ParsedIssueInput = z.infer<typeof parsedIssueInputSchema>;
