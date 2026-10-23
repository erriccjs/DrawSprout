import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.join(process.cwd(), 'src');

const SERVER_FILES = new Set([
  'photo/api.ts',
  'photo/openai.ts',
  'photo/pipeline.ts',
  'photo/replicate.ts',
  'photo/provider.ts',
  'photo/lesson-build.ts',
  'categories/http.ts',
  'categories/openai.ts',
  'categories/replicate.ts',
  'categories/classify.ts',
]);

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) found.push(full);
  }
  return found;
}

function resolveImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const specs = text.matchAll(/from\s+['"](\.[^'"]+)['"]/g);
  const resolved: string[] = [];
  for (const match of specs) {
    const spec = match[1];
    if (!spec) continue;
    const target = resolveImport(file, spec);
    if (target) resolved.push(target);
  }
  return resolved;
}

function relative(file: string): string {
  return path.relative(SRC, file).split(path.sep).join('/');
}

function isServer(file: string): boolean {
  const rel = relative(file);
  if (SERVER_FILES.has(rel)) return true;
  if (rel.startsWith('worker/')) return true;
  if (rel.startsWith('photo/lesson/')) return true;
  return false;
}

describe('browser and server modules', () => {
  it('does not let the app import a server module', () => {
    const roots = [
      path.join(SRC, 'main.tsx'),
      path.join(SRC, 'offline/service-worker.ts'),
      path.join(SRC, 'photo/client.ts'),
      ...walk(path.join(SRC, 'ui')),
    ];
    const seen = new Set<string>();
    const pending = [...roots];
    const leaks: string[] = [];
    while (pending.length > 0) {
      const file = pending.pop();
      if (!file || seen.has(file)) continue;
      seen.add(file);
      if (isServer(file)) {
        leaks.push(relative(file));
        continue;
      }
      pending.push(...importsOf(file));
    }
    expect(leaks).toEqual([]);
  });
});
