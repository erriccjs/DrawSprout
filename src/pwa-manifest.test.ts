import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('web app manifest', () => {
  it('asks for fullscreen and falls back to standalone', () => {
    const manifest = JSON.parse(readFileSync(path.join(process.cwd(), 'public/manifest.webmanifest'), 'utf8')) as {
      display: string;
      display_override: string[];
    };
    expect(manifest.display).toBe('fullscreen');
    expect(manifest.display_override).toEqual(['fullscreen', 'standalone']);
  });
});
