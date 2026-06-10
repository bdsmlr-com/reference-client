import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

function findHashedEntry(distDir) {
  const files = readdirSync(distDir);
  const candidates = files.filter((name) => /^main-[A-Za-z0-9_-]+\.js$/.test(name));
  if (candidates.length !== 1) {
    throw new Error(`Expected exactly one hashed main entry bundle in ${distDir}, found ${candidates.length}`);
  }
  return candidates[0];
}

function rewriteIndexHtml(indexPath, hashedEntry) {
  const html = readFileSync(indexPath, 'utf8');
  const rewritten = html.replace(`/v2/assets/${hashedEntry}`, '/v2/assets/main.js');
  if (rewritten === html) {
    throw new Error(`Could not find /v2/assets/${hashedEntry} in ${indexPath}`);
  }
  writeFileSync(indexPath, rewritten);
}

function main() {
  const distDir = resolve(process.argv[2] || 'dist');
  const indexPath = join(distDir, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error(`Missing index.html in ${distDir}`);
  }

  const hashedEntry = findHashedEntry(distDir);
  copyFileSync(join(distDir, hashedEntry), join(distDir, 'main.js'));
  rewriteIndexHtml(indexPath, hashedEntry);
}

main();
