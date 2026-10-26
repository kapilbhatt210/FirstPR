# FirstPR

**Paste an issue. Understand the work. Make your first contribution.**

FirstPR helps newcomers understand and plan a first contribution to a public
GitHub open-source issue. It analyzes the issue and repository, identifies
candidate files grounded in the actual file tree, extracts verified setup and
test commands, and produces a beginner-friendly contribution plan with a draft
pull request description.

---

## Problem and solution

Finding a good first issue is just the first step. Once you have one, it is
often unclear: Which files need to change? How do you set up the project? What
is a reasonable scope for the fix? What should the pull request say?

FirstPR answers those questions deterministically from the repository's own
documentation and file structure, without requiring prior knowledge of the
codebase. An optional Gemma 4 AI enhancement layer can add beginner-friendly
explanations and ordered steps, but the core analysis never requires an AI key.

---

## Features

- **GitHub issue ingestion** — Fetches issue metadata, repository info, README,
  CONTRIBUTING guidelines, file tree (up to 100 paths), and recent comments.
- **Deterministic briefing** — Computes difficulty, time estimate, candidate
  files (grounded in the actual tree), setup and test commands (with provenance
  labels), next steps, and warnings — all without calling a language model.
- **Command provenance** — Every suggested command is labelled
  `verified_in_docs`, `inferred_from_tree`, or `standard_fallback`. No command
  is presented as verified unless its exact text appeared in README or
  CONTRIBUTING.
- **Issue-state warnings** — Flags closed issues and assigned issues so
  contributors know to check before investing time.
- **PR draft** — Generates a copyable pull request title and markdown body
  template.
- **Optional Gemma 4 enhancement** — When a `GEMMA_API_KEY` is configured and
  `enableAi: true` is passed, a Gemma 4 model adds beginner-friendly summaries
  and ordered steps. If the AI call fails or is safety-filtered, the system
  falls back to the deterministic briefing transparently.
- **Security by design** — All repository content is treated as untrusted data.
  API keys stay server-side. Outbound requests are restricted to
  `https://api.github.com` with redirect validation.
- **Reusable agent skill** — The contribution workflow is also packaged as a
  standalone skill in `firstpr-skill/SKILL.md` for use with compatible coding
  agents.

---

## Architecture

```
Browser (Next.js client)
  └─ POST /api/briefing  { issueUrl, enableAi }
       │
       ├─ Validate request (Zod, body size limit, Content-Type)
       │
       ├─ GitHub Context Service  (src/lib/github/)
       │    ├─ Parse and validate issue URL
       │    ├─ safeFetch → api.github.com  (SSRF guard, redirect validation)
       │    ├─ Fetch repo metadata, issue, README, CONTRIBUTING, file tree, comments
       │    └─ Return GitHubIssueContext
       │
       ├─ Briefing Generator  (src/lib/briefing/generator.ts)
       │    ├─ Difficulty classification (labels + keywords)
       │    ├─ Candidate file grounding (keyword match against tree)
       │    ├─ Command extraction (README/CONTRIBUTING parse + manifest inference)
       │    ├─ Issue-state warnings (closed, assigned)
       │    └─ Return ContributionBriefing (Zod-validated)
       │
       ├─ AI Enhancer  (src/lib/briefing/enhancer.ts)  [optional]
       │    ├─ Gemma 4 via generativelanguage.googleapis.com (POST :generateContent)
       │    ├─ Safeguards: ground candidate paths, preserve commands, preserve warnings
       │    └─ Fallback to deterministic briefing on any AI error
       │
       └─ JSON response  { success, briefing, context, aiMetadata }
```

**Key source files:**

| Path | Purpose |
|---|---|
| `src/lib/github/url-parser.ts` | GitHub issue URL parsing and PR rejection |
| `src/lib/github/client.ts` | `safeFetch`, SSRF guard, redirect validation, bounds |
| `src/lib/github/context-service.ts` | Aggregates all GitHub API calls |
| `src/lib/github/types.ts` | Shared TypeScript types |
| `src/lib/briefing/schema.ts` | Zod contract for `ContributionBriefing` |
| `src/lib/briefing/generator.ts` | Deterministic briefing rules |
| `src/lib/briefing/enhancer.ts` | AI overlay with deterministic safeguards |
| `src/lib/briefing/service.ts` | Orchestration: ingest → generate → optionally enhance |
| `src/lib/briefing/pr-draft.ts` | PR title and markdown body generation |
| `src/lib/ai/gemma-provider.ts` | Gemma 4 HTTP client |
| `src/app/api/briefing/route.ts` | `POST /api/briefing` |
| `src/app/api/ingest/route.ts` | `POST /api/ingest` (raw context only) |
| `src/app/api/health/route.ts` | `GET /api/health` |
| `src/app/page.tsx` | Main page (form, hero, briefing view) |
| `src/components/` | UI components (Navbar, IssueForm, BriefingView, etc.) |

---

## Requirements

- Node.js 18 or later
- npm 9 or later
- A public GitHub repository and issue number to analyze

---

## Local installation

```bash
# 1. Clone the repository
git clone <your-fork-url>
cd firstpr

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env.local

# 4. Start the development server
npm run dev
```

The application starts at `http://localhost:3000`.

---

## Environment variables

Copy `.env.example` to `.env.local` and configure as needed.
**Never commit `.env.local` or any file containing real secrets.**

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Optional | GitHub personal access token. Raises API rate limit from 60 to 5,000 requests/hour. Recommended for consistent local use. |
| `GEMMA_API_KEY` | Optional | Google AI API key for Gemma 4 enhancement. If absent, the application runs in deterministic-only mode. |
| `GEMMA_MODEL_NAME` | Optional | Gemma model identifier. Defaults to `gemma-4-26b-a4b-it`. |
| `GEMMA_API_ENDPOINT` | Optional | Gemma API base URL. Defaults to `https://generativelanguage.googleapis.com/v1beta/models`. |
| `FIRSTPR_ENABLE_AI` | Optional | Set to `true` to enable AI enhancement by default on the server. The UI also exposes a per-request toggle. |

---

## Running in deterministic mode (no AI key required)

The core briefing — difficulty, candidate files, commands, next steps, warnings,
and PR draft — is fully generated without any AI API key.

```bash
# Copy env template and leave AI variables commented out
cp .env.example .env.local
npm run dev
```

The "Use AI enhancement" toggle in the UI is disabled when no key is configured.
The API returns `aiMetadata.enhanced: false`.

---

## Configuring and testing Gemma 4

1. Obtain a Google AI API key at `https://aistudio.google.com/app/apikey`.
2. Add it to `.env.local`:
   ```
   GEMMA_API_KEY=your_key_here
   ```
3. Run the smoke test (makes one small request; never prints your key):
   ```bash
   npm run test:gemma-smoke
   ```
4. Set `FIRSTPR_ENABLE_AI=true` in `.env.local` to enable AI by default, or
   use the per-request toggle in the UI.

If the AI call fails (network error, safety filter, timeout, malformed response),
the application falls back to the deterministic briefing and reports
`aiMetadata.enhanced: false` with an `aiMetadata.error` field.

---

## Commands

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build production bundle
npm run start        # Start production server (after build)
npm run test         # Run all unit and integration tests with Vitest
npm run typecheck    # Run TypeScript type checking (tsc --noEmit)
npm run lint         # Run ESLint
npm run test:gemma-smoke  # Opt-in smoke test against live Gemma API (requires GEMMA_API_KEY)
```

---

## Test suite

145 tests across 12 test files, run with [Vitest](https://vitest.dev):

```bash
npm test
```

| Area | Test file |
|---|---|
| URL parsing & PR rejection | `url-parser.test.ts` |
| GitHub client & SSRF safety | `github-client.test.ts` |
| Ingest API route | `ingest-route.test.ts` |
| Context service | `context-service.test.ts` |
| Briefing schema (Zod) | `briefing-schema.test.ts` |
| Deterministic generator | `briefing-generator.test.ts` |
| Briefing API route | `briefing-route.test.ts` |
| Gemma provider & AI safeguards | `gemma-provider.test.ts` |
| PR draft | `pr-draft.test.ts` |
| UI components | `ui-components.test.tsx` |
| Live public issue evaluation | `scripts/eval-real-issues.test.ts` |

---

## Security and privacy

- **SSRF protection** — All outbound GitHub API requests are validated against
  `https://api.github.com`. Redirect chains are followed only if they stay on
  the same host (max 3 hops). Cross-origin redirects are rejected.
- **Untrusted data isolation** — Issue body, README, comments, and file names
  are treated as untrusted input. They are never interpreted as instructions.
  When passed to the AI model, they are JSON-serialized as data values, not
  top-level prompt text.
- **No data persistence** — FirstPR does not store issue content, briefings, or
  API responses. Each request is processed in memory and discarded.
- **API keys server-side only** — `GEMMA_API_KEY` and `GITHUB_TOKEN` are never
  sent to the browser or included in API responses.
- **Request size limits** — Request bodies are rejected above 16 KB.
- **AI model output bounded** — Gemma responses are validated against a Zod
  schema. Candidate file paths suggested by the model are checked against the
  repository tree before use. Commands from the model are never used; only
  deterministic commands appear in output.

### Limitations

- Analyzes public GitHub issues only. Private repositories require a token with
  `repo` scope.
- Does not execute code, run tests, or verify that suggested commands work.
- File tree is bounded at 100 paths. Very large repositories may have relevant
  files omitted.
- AI enhancement requires a valid Gemma API key and is subject to external
  service availability and content policies.
- Difficulty and time estimates are heuristics, not guarantees.

---

## Agent skill

The contribution workflow is also available as a standalone reusable skill for
compatible coding agents. See [`firstpr-skill/SKILL.md`](firstpr-skill/SKILL.md).

---

## Contributing

Contributions are welcome. Please:

1. Open an issue to discuss significant changes before starting work.
2. Run `npm test`, `npm run typecheck`, and `npm run lint` before submitting a
   pull request. All checks must pass.
3. Keep pull requests focused on a single concern.
4. Do not commit `.env.local` or any file containing real credentials.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
