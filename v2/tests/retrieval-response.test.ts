import * as ts from 'typescript';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function flattenDiagnosticMessage(messageText: string | ts.DiagnosticMessageChain): string {
  return ts.flattenDiagnosticMessageText(messageText, '\n');
}

function getMissingPropertyDiagnosticMessages(diagnostics: readonly ts.Diagnostic[], propertyName: string): string[] {
  return diagnostics
    .filter((diagnostic) => diagnostic.code === 2353)
    .map((diagnostic) => flattenDiagnosticMessage(diagnostic.messageText))
    .filter((message) => message.includes(`'${propertyName}'`));
}

describe('retrieval response typing', () => {
  it('reports the missing retrieval contract fields in the handwritten client types', () => {
    const scratchDir = mkdtempSync(join(process.cwd(), 'tests', '.retrieval-response-'));
    const entryFile = join(scratchDir, 'check.ts');

    writeFileSync(
      entryFile,
      [
        "import type { SearchPostsByTagResponse } from '../../src/types/api.js';",
        '',
        'const responseWithPolicy: SearchPostsByTagResponse = {',
        '  posts: [],',
        "  page: { nextPageToken: 'abc' },",
        '  policy: {',
        '    defaultResultWindowLimit: 100,',
        '    clearResultCount: 10,',
        "    ditherStrategy: 'origin_blog_post_keyed_sha256',",
        "    imageVariants: ['feed', 'feed-pixelated', 'feed-pixelated-animated'],",
        '    capabilities: [],',
        '  },',
        '};',
        '',
        'const responseWithPostPolicies: SearchPostsByTagResponse = {',
        '  posts: [],',
        "  page: { nextPageToken: 'abc' },",
        '  postPolicies: {},',
        '};',
        '',
        'void responseWithPolicy.page?.nextPageToken;',
        'void responseWithPostPolicies.page?.nextPageToken;',
        '',
      ].join('\n'),
      'utf8',
    );

    try {
      const program = ts.createProgram([entryFile], {
        noEmit: true,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        strict: true,
        skipLibCheck: true,
      });
      const diagnostics = ts.getPreEmitDiagnostics(program).filter((diagnostic) => diagnostic.file?.fileName === entryFile);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(getMissingPropertyDiagnosticMessages(diagnostics, 'policy')).not.toHaveLength(0);
      expect(getMissingPropertyDiagnosticMessages(diagnostics, 'postPolicies')).not.toHaveLength(0);
    } finally {
      rmSync(scratchDir, { recursive: true, force: true });
    }
  });
});
