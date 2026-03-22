/**
 * Minimal HTML sanitizer for rendering trusted-ish fragments without allowing script execution.
 * This intentionally strips active content and inline event handlers.
 */
export function sanitizeHtmlFragment(input: string | null | undefined): string {
  if (!input) return '';

  let out = String(input);

  // Remove executable or embedding tags completely.
  out = out.replace(/<\s*(script|style|iframe|object|embed|template|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  out = out.replace(/<\s*(script|style|iframe|object|embed|template|svg|math)\b[^>]*\/?\s*>/gi, '');

  // Remove inline event handlers like onclick=...
  out = out.replace(/\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');

  // Block javascript: and data:text/html URL payloads in href/src/xlink:href.
  out = out.replace(
    /\s+(href|src|xlink:href)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (_full, attr, _raw, dq, sq, bare) => {
      const rawVal = (dq ?? sq ?? bare ?? '').trim();
      const cleaned = rawVal.toLowerCase();
      if (cleaned.startsWith('javascript:') || cleaned.startsWith('data:text/html')) {
        return ` ${attr}="#"`;
      }
      return ` ${attr}="${rawVal}"`;
    }
  );

  return out;
}
