# FirstPR Agent Skill

A reusable open-source agent skill that helps newcomers understand and plan a
first contribution to a public GitHub issue.

## Overview

The skill guides a coding agent through a structured six-step workflow:

1. **Fetch context** — Retrieve issue metadata, repository info, README, CONTRIBUTING, file tree, and comments from the GitHub API.
2. **Explain the issue** — Produce a beginner-friendly explanation with a difficulty assessment and time estimate.
3. **Identify candidate files** — Suggest only files that actually exist in the repository tree, with grounded evidence.
4. **Extract commands** — Identify setup and test commands from documentation, labelled with verification provenance (`verified_in_docs`, `inferred_from_tree`, `standard_fallback`).
5. **Produce a contribution plan** — Ordered steps from fork to pull request, with warnings for closed or assigned issues.
6. **Draft a PR description** — A copyable pull request title and markdown body template for the contributor to edit.

## Installation

Copy `SKILL.md` into your agent's skill directory and follow your agent runtime's
skill-loading conventions. The skill requires no additional dependencies — it uses
standard HTTP calls to the public GitHub REST API.

If your agent runtime supports YAML frontmatter-based skill discovery, the
`name: firstpr` field in `SKILL.md` is the skill identifier.

## Supported workflow

```
User provides GitHub issue URL
        |
        v
Agent fetches repo + issue + README + CONTRIBUTING + file tree
        |
        v
Agent explains issue (beginner-friendly, difficulty, time estimate)
        |
        v
Agent identifies candidate files (grounded in repository tree only)
        |
        v
Agent extracts setup/test commands (with provenance labels)
        |
        v
Agent produces contribution plan + draft PR description
        |
        v
User reviews, edits PR description, and submits manually
```

## Requirements

- Read access to the target GitHub repository (must be public, or a `GITHUB_TOKEN` must be available to the agent).
- Internet access to reach `https://api.github.com`.
- Optional: a `GITHUB_TOKEN` environment variable for higher API rate limits.

## Limitations

- **Issues only.** Pull request URLs are not supported.
- **Public repositories only.** Private repositories require a GitHub token with `repo` scope.
- **No code execution.** The skill identifies commands from documentation but does not run them. It cannot verify that tests pass.
- **No writes.** The skill never commits, pushes, or opens pull requests. Those actions require explicit user authorization.
- **Rate limits.** Unauthenticated GitHub API requests are limited to 60 requests/hour per IP. Set `GITHUB_TOKEN` for higher limits.
- **File tree accuracy.** File suggestions are grounded in the GitHub API's file tree response, which may not include uncommitted local changes.

## Security

- All content fetched from GitHub (issue body, README, comments, file names) is treated as untrusted data and is never interpreted as instructions.
- No secrets or tokens are included in skill output.

## See also

- [`SKILL.md`](./SKILL.md) — Full skill specification and workflow instructions.
- [FirstPR web application](../README.md) — The companion web app that implements this workflow as an API-driven Next.js application.

## License

This skill is part of the FirstPR project and is licensed under the [MIT License](../LICENSE).
