import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from './shared/http';

describe('security headers', () => {
  it('puts the same policy on the shell, the service worker, and the manifest', () => {
    const text = readFileSync(path.join(process.cwd(), 'public/_headers'), 'utf8');
    const blocks = text.split(/\n(?=\/\S)/).filter((block) => block.trimStart().startsWith('/'));
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    for (const block of blocks) {
      expect(block).toContain(`Content-Security-Policy: ${CONTENT_SECURITY_POLICY}`);
      expect(block.toLowerCase()).toContain(`x-content-type-options: ${SECURITY_HEADERS['x-content-type-options']}`);
      expect(block).toContain(`Referrer-Policy: ${SECURITY_HEADERS['referrer-policy']}`);
      expect(block).toContain(`Permissions-Policy: ${SECURITY_HEADERS['permissions-policy']}`);
    }
    expect(text).toContain('camera=(self)');
    expect(CONTENT_SECURITY_POLICY).not.toContain('unsafe-eval');
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("style-src 'self' 'unsafe-inline'");
  });
});
