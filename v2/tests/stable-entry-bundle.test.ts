import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const SCRIPT = join(process.cwd(), 'scripts/stabilize-entry-bundle.mjs');

describe('stable entry bundle build step', () => {
  it('copies the hashed entry bundle to main.js and rewrites index.html to the stable URL', () => {
    const root = mkdtempSync(join(tmpdir(), 'bdsmlr-stable-entry-'));
    const dist = join(root, 'dist');
    mkdirSync(dist, { recursive: true });

    writeFileSync(join(dist, 'main-abc123.js'), 'console.log(\'entry\');');
    writeFileSync(
      join(dist, 'index.html'),
      '<!doctype html><html><body><script type="module" crossorigin src="/v2/assets/main-abc123.js"></script></body></html>'
    );

    execFileSync('node', [SCRIPT, dist], { cwd: process.cwd() });

    expect(existsSync(join(dist, 'main.js'))).toBe(true);
    expect(readFileSync(join(dist, 'main.js'), 'utf8')).toBe("console.log('entry');");
    expect(readFileSync(join(dist, 'index.html'), 'utf8')).toContain('/v2/assets/main.js');
    expect(readFileSync(join(dist, 'index.html'), 'utf8')).not.toContain('/v2/assets/main-abc123.js');
  });

  it('is idempotent when index.html already references the stable URL', () => {
    const root = mkdtempSync(join(tmpdir(), 'bdsmlr-stable-entry-idempotent-'));
    const dist = join(root, 'dist');
    mkdirSync(dist, { recursive: true });

    writeFileSync(join(dist, 'main-abc123.js'), 'console.log(\'entry\');');
    writeFileSync(join(dist, 'main.js'), 'console.log(\'entry\');');
    writeFileSync(
      join(dist, 'index.html'),
      '<!doctype html><html><body><script type="module" crossorigin src="/v2/assets/main.js"></script></body></html>'
    );

    execFileSync('node', [SCRIPT, dist], { cwd: process.cwd() });

    expect(readFileSync(join(dist, 'main.js'), 'utf8')).toBe("console.log('entry');");
    expect(readFileSync(join(dist, 'index.html'), 'utf8')).toContain('/v2/assets/main.js');
    expect(readFileSync(join(dist, 'index.html'), 'utf8')).not.toContain('/v2/assets/main-abc123.js');
  });
});
