#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

const targetRoot = process.argv[2]
  ? (isAbsolute(process.argv[2]) ? process.argv[2] : join(process.cwd(), process.argv[2]))
  : join(process.cwd(), 'src');
const forbiddenTagPatterns = [
  /<post-feed-item\b/,
  /<post-card\b/,
  /<blog-card\b/,
];

const allowList = new Set([
  join(targetRoot, 'components', 'timeline-stream.ts'),
  join(targetRoot, 'components', 'post-feed-item.ts'),
  join(targetRoot, 'components', 'post-card.ts'),
  join(targetRoot, 'components', 'blog-card.ts'),
  join(targetRoot, 'components', 'post-feed.ts'),
  join(targetRoot, 'components', 'post-grid.ts'),
  join(targetRoot, 'pages', 'view-blogs.ts'),
  join(targetRoot, 'pages', 'view-discover.ts'),
  join(targetRoot, 'pages', 'view-post.ts'),
]);

function collectTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectTsFiles(full));
      continue;
    }
    if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const offenders = [];
  const files = collectTsFiles(targetRoot);
  for (const file of files) {
    if (allowList.has(file)) continue;
    const content = readFileSync(file, 'utf8');
    if (forbiddenTagPatterns.some((pattern) => pattern.test(content))) {
      offenders.push(relative(process.cwd(), file));
    }
  }

  if (offenders.length > 0) {
    console.error('render-contract-usage check failed: ad hoc legacy card markup found');
    for (const offender of offenders) {
      console.error(` - ${offender}`);
    }
    process.exit(1);
  }

  console.log('render-contract-usage check passed');
}

main();
