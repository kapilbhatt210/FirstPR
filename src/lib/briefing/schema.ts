import { z } from 'zod';

/**
 * Difficulty levels for prospective contributors.
 */
export const difficultyLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type DifficultyLevel = z.infer<typeof difficultyLevelSchema>;

/**
 * Estimated time range in minutes.
 */
export const timeRangeSchema = z
  .object({
    minMinutes: z.number().int().nonnegative(),
    maxMinutes: z.number().int().positive(),
    isEstimate: z.boolean().default(true),
  })
  .refine((data) => data.maxMinutes >= data.minMinutes, {
    message: 'maxMinutes must be greater than or equal to minMinutes',
  });
export type TimeRange = z.infer<typeof timeRangeSchema>;

/**
 * A file identified as likely relevant to resolving the issue.
 */
export const candidateFileSchema = z.object({
  path: z.string().min(1, 'File path cannot be empty'),
  reason: z.string().min(1, 'Reason must be provided'),
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
});
export type CandidateFile = z.infer<typeof candidateFileSchema>;

/**
 * Provenance / verification status of a suggested shell command.
 */
export const commandSourceStatusSchema = z.enum([
  'verified_in_docs',
  'inferred_from_tree',
  'standard_fallback',
]);
export type CommandSourceStatus = z.infer<typeof commandSourceStatusSchema>;

/**
 * A command for local workspace setup or test execution.
 */
export const commandItemSchema = z.object({
  command: z.string().min(1, 'Command cannot be empty'),
  description: z.string().optional(),
  source: z.string().min(1, 'Source description cannot be empty'),
  verificationStatus: commandSourceStatusSchema,
});
export type CommandItem = z.infer<typeof commandItemSchema>;

/**
 * Complete deterministic contribution briefing schema.
 */
export const contributionBriefingSchema = z.object({
  repository: z.object({
    fullName: z.string().min(1),
    defaultBranch: z.string().nullable(),
  }),
  issue: z.object({
    issueNumber: z.number().int().positive(),
    title: z.string().min(1),
    canonicalUrl: z.string().url(),
    state: z.enum(['open', 'closed']).optional(),
    assignees: z.array(z.string()).default([]),
  }),
  summary: z.string().min(1, 'Summary cannot be empty'),
  difficulty: difficultyLevelSchema,
  difficultyRationale: z.string().min(1, 'Difficulty rationale cannot be empty'),
  estimatedTimeMinutes: timeRangeSchema,
  candidateFiles: z.array(candidateFileSchema),
  setupCommands: z.array(commandItemSchema),
  testCommands: z.array(commandItemSchema),
  nextSteps: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  generatedAt: z.string().min(1),
});

export type ContributionBriefing = z.infer<typeof contributionBriefingSchema>;
