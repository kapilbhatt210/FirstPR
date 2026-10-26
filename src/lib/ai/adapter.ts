import { ContributionBriefing } from '../briefing/schema';
import { GitHubIssueContext } from '../github/types';

/**
 * Provider-independent AI adapter interface for FirstPR.
 *
 * Defines the contract for AI-powered issue analysis,
 * guideline extraction, step-by-step contribution planning,
 * and PR draft generation (e.g. Gemma 4 integration).
 */

export interface IssueAnalysisRequest {
  issueTitle: string;
  issueBody: string;
  repositoryUrl: string;
  contributingGuidelines?: string;
  screenshotBase64?: string;
}

export interface ContributionPlanStep {
  stepNumber: number;
  title: string;
  description: string;
  targetFiles?: string[];
}

export interface IssueAnalysisResult {
  summary: string;
  relevantFiles: string[];
  suggestedSteps: ContributionPlanStep[];
  draftPrDescription?: string;
}

export interface AiModelAdapter {
  readonly providerName: string;
  analyzeIssue(request: IssueAnalysisRequest): Promise<IssueAnalysisResult>;
}

/**
 * Request payload for AI-assisted briefing enhancement.
 * Supplies both the raw GitHub context and the deterministic baseline.
 */
export interface BriefingEnhancementRequest {
  context: GitHubIssueContext;
  deterministicBriefing: ContributionBriefing;
}

/**
 * Structured enhancement output expected from an AI model.
 */
export interface BriefingEnhancementResult {
  enhancedSummary?: string;
  enhancedRationale?: string;
  suggestedCandidateFiles?: Array<{
    path: string;
    reason: string;
  }>;
  suggestedNextSteps?: string[];
  identifiedRisks?: string[];
}

/**
 * Interface for AI providers that enhance contribution briefings.
 */
export interface AiBriefingEnhancer {
  readonly providerName: string;
  readonly modelIdentifier: string;
  enhanceBriefing(request: BriefingEnhancementRequest): Promise<BriefingEnhancementResult>;
}
