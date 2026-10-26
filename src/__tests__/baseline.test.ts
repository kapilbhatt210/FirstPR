import { describe, it, expect } from 'vitest';
import { issueInputSchema } from '../lib/validation/issue';

describe('Phase 1 Baseline Verification', () => {
  it('validates GitHub issue URL correctly', () => {
    const valid = issueInputSchema.safeParse({
      issueUrl: 'https://github.com/facebook/react/issues/12345',
    });
    expect(valid.success).toBe(true);

    const invalid = issueInputSchema.safeParse({
      issueUrl: 'https://example.com/not-github',
    });
    expect(invalid.success).toBe(false);
  });
});
