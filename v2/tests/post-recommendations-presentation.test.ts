import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/components/post-recommendations.ts');

describe('post recommendations presentation', () => {
  it('routes recommendation metadata through the shared presentation model', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain("import { toPresentationModel } from '../services/post-presentation.js';");
    expect(src).toContain("const presentation = toPresentationModel(h, { surface: 'card', page: 'post' });");
    expect(src).toContain("presentation.identity.viaBlogLabel");
    expect(src).toContain("presentation.identity.permalink.label");
    expect(src).toContain("presentation.identity.permalink.icon");
  });
});
