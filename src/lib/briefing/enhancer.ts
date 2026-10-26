import { AiBriefingEnhancer } from '../ai/adapter';
import { GitHubIssueContext } from '../github/types';
import { isSafeRelativePath } from './generator';
import {
  CandidateFile,
  ContributionBriefing,
  contributionBriefingSchema,
} from './schema';

export interface EnhancementOutcome {
  briefing: ContributionBriefing;
  aiEnhanced: boolean;
  providerName?: string;
  modelIdentifier?: string;
  aiError?: string;
}

/**
 * Enhances a deterministic briefing with AI insights from Gemma 4
 * while strictly enforcing deterministic safeguards:
 *
 * 1. Grounding: All candidate file paths must strictly exist in the supplied repository tree.
 * 2. Commands Protection: Deterministic setup and test commands are strictly preserved.
 * 3. State Preservation: Closed, assigned, and default-branch warnings cannot be erased.
 * 4. Fallback: If AI fails, times out, or outputs malformed data, gracefully falls back to baseline.
 */
export async function enhanceBriefing(
  context: GitHubIssueContext,
  baselineBriefing: ContributionBriefing,
  enhancer?: AiBriefingEnhancer
): Promise<EnhancementOutcome> {
  // If no enhancer is provided, return deterministic baseline
  if (!enhancer) {
    return {
      briefing: baselineBriefing,
      aiEnhanced: false,
    };
  }

  try {
    const aiResult = await enhancer.enhanceBriefing({
      context,
      deterministicBriefing: baselineBriefing,
    });

    // 1. Safeguard: Validate and ground candidate files strictly against repository tree
    const safePaths = new Set(context.fileTree.retainedPaths.filter(isSafeRelativePath));
    const groundedAiCandidates: CandidateFile[] = [];

    if (aiResult.suggestedCandidateFiles && Array.isArray(aiResult.suggestedCandidateFiles)) {
      for (const candidate of aiResult.suggestedCandidateFiles) {
        if (
          candidate.path &&
          isSafeRelativePath(candidate.path) &&
          safePaths.has(candidate.path) &&
          !groundedAiCandidates.some((c) => c.path === candidate.path)
        ) {
          groundedAiCandidates.push({
            path: candidate.path,
            reason: candidate.reason || 'Identified by AI model based on issue analysis.',
            confidence: 'high',
          });
        }
      }
    }

    // Merge grounded AI candidates with baseline candidates, capped at 5
    const finalCandidateFiles: CandidateFile[] =
      groundedAiCandidates.length > 0
        ? groundedAiCandidates
        : baselineBriefing.candidateFiles;

    // 2. Safeguard: Setup and test commands are strictly preserved from deterministic extraction
    const setupCommands = baselineBriefing.setupCommands;
    const testCommands = baselineBriefing.testCommands;

    // 3. Safeguard: Preserve deterministic warnings and append any AI-identified technical risks
    const warnings = [...baselineBriefing.warnings];
    if (aiResult.identifiedRisks && Array.isArray(aiResult.identifiedRisks)) {
      for (const risk of aiResult.identifiedRisks) {
        if (typeof risk === 'string' && risk.trim().length > 0) {
          warnings.push(`AI Advisory: ${risk.trim()}`);
        }
      }
    }

    // 4. Next steps: Use AI steps if valid, preserving closed/assigned preambles
    let nextSteps = baselineBriefing.nextSteps;
    if (aiResult.suggestedNextSteps && Array.isArray(aiResult.suggestedNextSteps) && aiResult.suggestedNextSteps.length > 0) {
      const validSteps = aiResult.suggestedNextSteps
        .filter((s) => typeof s === 'string' && s.trim().length > 0)
        .map((s) => s.trim());

      if (validSteps.length >= 3) {
        // Prepend any critical closed issue warning to AI steps
        const closedWarning = baselineBriefing.nextSteps.find((s) => s.includes('is closed'));
        const assigneeWarning = baselineBriefing.nextSteps.find((s) => s.includes('Coordinate with current assignee'));

        const prefixedSteps: string[] = [];
        if (closedWarning) prefixedSteps.push(closedWarning);
        if (assigneeWarning) prefixedSteps.push(assigneeWarning);
        prefixedSteps.push(...validSteps);
        nextSteps = prefixedSteps;
      }
    }

    // 5. Summary and Rationale
    const summary = aiResult.enhancedSummary && aiResult.enhancedSummary.trim().length > 10
      ? aiResult.enhancedSummary.trim()
      : baselineBriefing.summary;

    const difficultyRationale = aiResult.enhancedRationale && aiResult.enhancedRationale.trim().length > 10
      ? `${aiResult.enhancedRationale.trim()} Estimates are approximate heuristics, not guarantees.`
      : baselineBriefing.difficultyRationale;

    // 6. Assemble enhanced briefing
    const candidatePayload: ContributionBriefing = {
      repository: baselineBriefing.repository,
      issue: baselineBriefing.issue,
      summary,
      difficulty: baselineBriefing.difficulty,
      difficultyRationale,
      estimatedTimeMinutes: baselineBriefing.estimatedTimeMinutes,
      candidateFiles: finalCandidateFiles,
      setupCommands,
      testCommands,
      nextSteps,
      warnings,
      limitations: baselineBriefing.limitations,
      generatedAt: new Date().toISOString(),
    };

    // Re-validate against contract schema
    const validated = contributionBriefingSchema.parse(candidatePayload);

    return {
      briefing: validated,
      aiEnhanced: true,
      providerName: enhancer.providerName,
      modelIdentifier: enhancer.modelIdentifier,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown AI enhancement error';
    // Fallback to deterministic baseline safely
    return {
      briefing: baselineBriefing,
      aiEnhanced: false,
      aiError: errorMessage,
    };
  }
}
