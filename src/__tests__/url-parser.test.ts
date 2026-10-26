import { describe, it, expect } from 'vitest';
import { parseGitHubIssueUrl } from '../lib/github/url-parser';
import { issueInputSchema } from '../lib/validation/issue';

describe('GitHub Issue URL Parser & Schema Validation', () => {
  describe('parseGitHubIssueUrl', () => {
    it('successfully parses a standard valid GitHub issue URL', () => {
      const result = parseGitHubIssueUrl('https://github.com/facebook/react/issues/12345');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          owner: 'facebook',
          repo: 'react',
          issueNumber: 12345,
          canonicalUrl: 'https://github.com/facebook/react/issues/12345',
        });
      }
    });

    it('handles whitespace around valid URLs', () => {
      const result = parseGitHubIssueUrl('   https://github.com/vercel/next.js/issues/789   ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.owner).toBe('vercel');
        expect(result.data.repo).toBe('next.js');
        expect(result.data.issueNumber).toBe(789);
        expect(result.data.canonicalUrl).toBe('https://github.com/vercel/next.js/issues/789');
      }
    });

    it('strips .git suffix from repository name if present', () => {
      const result = parseGitHubIssueUrl('https://github.com/owner/my-repo.git/issues/42');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.repo).toBe('my-repo');
        expect(result.data.canonicalUrl).toBe('https://github.com/owner/my-repo/issues/42');
      }
    });

    it('rejects non-HTTPS protocol', () => {
      const result = parseGitHubIssueUrl('http://github.com/facebook/react/issues/123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/protocol must be https:/i);
      }
    });

    it('rejects unrelated domains and lookalikes', () => {
      const domains = [
        'https://gitlab.com/facebook/react/issues/123',
        'https://github.com.attacker.com/facebook/react/issues/123',
        'https://notgithub.com/facebook/react/issues/123',
        'https://api.github.com/repos/facebook/react/issues/123',
      ];
      for (const url of domains) {
        const result = parseGitHubIssueUrl(url);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toMatch(/hostname must strictly be "github.com"/i);
        }
      }
    });

    it('explicitly rejects pull request URLs (/pull/ and /pulls/)', () => {
      const prUrls = [
        'https://github.com/facebook/react/pull/1234',
        'https://github.com/facebook/react/pulls/1234',
      ];
      for (const url of prUrls) {
        const result = parseGitHubIssueUrl(url);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toMatch(/pull request URLs are not supported/i);
        }
      }
    });

    it('rejects query parameters', () => {
      const result = parseGitHubIssueUrl('https://github.com/facebook/react/issues/123?filter=all');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/unexpected query parameters/i);
      }
    });

    it('rejects URL fragments / hashes', () => {
      const result = parseGitHubIssueUrl('https://github.com/facebook/react/issues/123#issuecomment-456');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/unexpected url fragment/i);
      }
    });

    it('rejects non-positive issue numbers (zero, negative, decimals)', () => {
      const invalidNumbers = [
        'https://github.com/owner/repo/issues/0',
        'https://github.com/owner/repo/issues/-5',
        'https://github.com/owner/repo/issues/12.3',
        'https://github.com/owner/repo/issues/abc',
      ];
      for (const url of invalidNumbers) {
        const result = parseGitHubIssueUrl(url);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toMatch(/invalid issue number/i);
        }
      }
    });

    it('rejects invalid path segments or extra subpaths', () => {
      const invalidPaths = [
        'https://github.com/owner/repo/issues',
        'https://github.com/owner/repo/issues/123/comments',
        'https://github.com/owner/repo',
        'https://github.com/owner',
      ];
      for (const url of invalidPaths) {
        const result = parseGitHubIssueUrl(url);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toMatch(/must match the format/i);
        }
      }
    });

    it('rejects malformed or malicious repository/owner names', () => {
      const invalidOwners = [
        'https://github.com/-invalid/repo/issues/1',
        'https://github.com/invalid-/repo/issues/1',
        'https://github.com/../repo/issues/1',
        'https://github.com/owner/../issues/1',
      ];
      for (const url of invalidOwners) {
        const result = parseGitHubIssueUrl(url);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('issueInputSchema Zod validation', () => {
    it('passes for valid issue input', () => {
      const parsed = issueInputSchema.safeParse({
        issueUrl: 'https://github.com/facebook/react/issues/100',
      });
      expect(parsed.success).toBe(true);
    });

    it('fails with descriptive error for invalid issue input', () => {
      const parsed = issueInputSchema.safeParse({
        issueUrl: 'https://github.com/facebook/react/pull/100',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.errors[0].message).toMatch(/pull request URLs are not supported/i);
      }
    });
  });
});
