import { createBriefingFromUrl } from '../src/lib/briefing/service.ts';

const EVAL_ISSUES = [
  {
    category: '1. Documentation or typo issue',
    url: 'https://github.com/facebook/react/issues/28000',
    description: 'Documentation / typing or edge case issue in React',
  },
  {
    category: '2. Simple bug report',
    url: 'https://github.com/vercel/next.js/issues/50000',
    description: 'Bug report in Next.js',
  },
  {
    category: '3. UI / styling issue',
    url: 'https://github.com/tailwindlabs/tailwindcss/issues/10000',
    description: 'UI / CSS styling issue in Tailwind CSS',
  },
  {
    category: '4. Repository with minimal/missing contribution guide',
    url: 'https://github.com/octocat/Hello-World/issues/1',
    description: 'Minimal repository without extensive CONTRIBUTING.md',
  },
  {
    category: '5. Closed or assigned issue',
    url: 'https://github.com/facebook/react/issues/28000',
    description: 'Closed issue verifying state preservation & warnings',
  },
];

async function runEvaluation() {
  console.log('='.repeat(70));
  console.log('FirstPR — Real Public GitHub Issue Evaluation');
  console.log('Testing deterministic backend flow on public repositories');
  console.log('='.repeat(70));

  const results = [];

  for (const item of EVAL_ISSUES) {
    console.log(`\nEvaluating [${item.category}]: ${item.url}`);
    const start = Date.now();
    try {
      const result = await createBriefingFromUrl(item.url, { enableAi: false });
      const duration = Date.now() - start;

      if (!result.success) {
        console.log(`❌ Ingestion failed (${result.error.code}, ${result.error.status}): ${result.error.message}`);
        results.push({
          category: item.category,
          url: item.url,
          outcome: 'FAILED',
          status: result.error.status,
          code: result.error.code,
          message: result.error.message,
          durationMs: duration,
        });
      } else {
        const { briefing, context, aiMetadata } = result;
        const isClosed = briefing.issue.state === 'closed';
        const candidateFilesCount = briefing.candidateFiles.length;
        const setupCmdsCount = briefing.setupCommands.length;
        const testCmdsCount = briefing.testCommands.length;
        const warningsCount = briefing.warnings.length;

        console.log(`✅ Success in ${duration}ms!`);
        console.log(`   Repo: ${briefing.repository.fullName} (branch: ${briefing.repository.defaultBranch})`);
        console.log(`   Issue: #${briefing.issue.issueNumber} "${briefing.issue.title}" [State: ${briefing.issue.state}]`);
        console.log(`   Difficulty: ${briefing.difficulty} (${briefing.estimatedTimeMinutes.minMinutes}-${briefing.estimatedTimeMinutes.maxMinutes} mins)`);
        console.log(`   Candidate Files (${candidateFilesCount}): ${briefing.candidateFiles.map(f => f.path).join(', ') || 'None'}`);
        console.log(`   Commands: ${setupCmdsCount} setup, ${testCmdsCount} test`);
        console.log(`   State Warnings: ${isClosed ? 'Closed Warning Present' : 'Open'} (Total Warnings: ${warningsCount})`);
        console.log(`   AI Enhanced: ${aiMetadata?.enhanced ? 'Yes' : 'No (Deterministic Baseline)'}`);

        results.push({
          category: item.category,
          url: item.url,
          outcome: 'SUCCESS',
          durationMs: duration,
          repo: briefing.repository.fullName,
          branch: briefing.repository.defaultBranch,
          issueNumber: briefing.issue.issueNumber,
          title: briefing.issue.title,
          state: briefing.issue.state,
          candidateFiles: briefing.candidateFiles.map(f => f.path),
          setupCommands: briefing.setupCommands.map(c => `${c.command} (${c.verificationStatus})`),
          testCommands: briefing.testCommands.map(c => `${c.command} (${c.verificationStatus})`),
          warnings: briefing.warnings,
          limitations: briefing.limitations,
        });
      }
    } catch (err) {
      console.log(`❌ Unexpected error: ${err.message}`);
      results.push({
        category: item.category,
        url: item.url,
        outcome: 'ERROR',
        error: err.message,
      });
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Evaluation Summary:');
  console.log(JSON.stringify(results, null, 2));
}

runEvaluation();
