import { AiBriefingEnhancer } from '../ai/adapter';
import { GemmaProvider } from '../ai/gemma-provider';
import { ingestGitHubIssue, IngestIssueOptions } from '../github/context-service';
import { GitHubIssueContext, IngestionError } from '../github/types';
import { enhanceBriefing } from './enhancer';
import { generateContributionBriefing } from './generator';
import { ContributionBriefing } from './schema';

export type GenerateBriefingOptions = IngestIssueOptions & {
  enableAi?: boolean;
  aiEnhancer?: AiBriefingEnhancer;
};

export type BriefingResult =
  | {
      success: true;
      briefing: ContributionBriefing;
      context: GitHubIssueContext;
      warnings?: string[];
      aiMetadata?: {
        enhanced: boolean;
        provider?: string;
        model?: string;
        error?: string;
      };
    }
  | {
      success: false;
      error: IngestionError;
    };

/**
 * High-level service: given a GitHub issue URL, ingests repository context,
 * generates a deterministic briefing, and optionally enhances it with Gemma 4.
 */
export async function createBriefingFromUrl(
  issueUrl: string,
  options?: GenerateBriefingOptions
): Promise<BriefingResult> {
  const ingestionResult = await ingestGitHubIssue(issueUrl, options);

  if (!ingestionResult.success) {
    return {
      success: false,
      error: ingestionResult.error,
    };
  }

  const baselineBriefing = generateContributionBriefing(ingestionResult.data);

  // Check whether AI enhancement should run
  const shouldRunAi =
    options?.enableAi ??
    Boolean(options?.aiEnhancer || (process.env.GEMMA_API_KEY && process.env.FIRSTPR_ENABLE_AI === 'true'));

  if (!shouldRunAi) {
    return {
      success: true,
      briefing: baselineBriefing,
      context: ingestionResult.data,
      warnings: ingestionResult.warnings,
      aiMetadata: {
        enhanced: false,
      },
    };
  }

  const enhancer = options?.aiEnhancer ?? new GemmaProvider();
  const outcome = await enhanceBriefing(ingestionResult.data, baselineBriefing, enhancer);

  return {
    success: true,
    briefing: outcome.briefing,
    context: ingestionResult.data,
    warnings: ingestionResult.warnings,
    aiMetadata: {
      enhanced: outcome.aiEnhanced,
      provider: outcome.providerName,
      model: outcome.modelIdentifier,
      error: outcome.aiError,
    },
  };
}

/**
 * Generates a briefing directly from an already-ingested GitHub context.
 */
export function createBriefingFromContext(context: GitHubIssueContext): ContributionBriefing {
  return generateContributionBriefing(context);
}
