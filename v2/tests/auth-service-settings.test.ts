import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('auth service settings endpoints', () => {
  it('exposes typed user and blog settings helpers', () => {
    const src = readFileSync(join(ROOT, 'services/auth-service.ts'), 'utf8');

    expect(src).toContain('export type UserSettingsResponse');
    expect(src).toContain('export type BlogSettingsResponse');
    expect(src).toContain('export const getUserSettings = (username: string) =>');
    expect(src).toContain("fetchJson<UserSettingsResponse>(");
    expect(src).toContain("'/settings/user'");
    expect(src).toContain('export const getBlogSettings = (blogName: string) =>');
    expect(src).toContain("fetchJson<BlogSettingsResponse>(");
    expect(src).toContain("'/settings/blog'");
  });
});
