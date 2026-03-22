import { describe, it, expect } from 'vitest';
import { sanitizeHtmlFragment } from '../src/services/html-sanitizer.js';

describe('sanitizeHtmlFragment', () => {
  it('removes scripts and event handlers', () => {
    const input = '<p onclick="alert(1)">ok</p><script>alert(2)</script><img src="x" onerror="alert(3)">';
    const out = sanitizeHtmlFragment(input);

    expect(out).toContain('<p>ok</p>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('onclick=');
    expect(out).not.toContain('onerror=');
  });

  it('blocks javascript: URLs', () => {
    const input = '<a href="javascript:alert(1)">x</a><img src="javascript:alert(2)">';
    const out = sanitizeHtmlFragment(input);

    expect(out).not.toContain('javascript:');
  });
});
