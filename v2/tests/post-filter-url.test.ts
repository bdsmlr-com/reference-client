import { describe, expect, it } from 'vitest';

import {
  parsePostTypesParam,
  parseVariantsParam,
  serializePostTypesParam,
  serializeVariantsParam,
} from '../src/services/post-filter-url.js';

describe('post filter url codecs', () => {
  it('parses text and numeric post type params compatibly', () => {
    expect(parsePostTypesParam('text,image,7')).toEqual([1, 2, 7]);
    expect(parsePostTypesParam('1,2,quote')).toEqual([1, 2, 7]);
  });

  it('serializes post types to readable tokens', () => {
    expect(serializePostTypesParam([1, 2, 7])).toBe('text,image,quote');
  });

  it('parses text and numeric variant params compatibly', () => {
    expect(parseVariantsParam('original,reblog')).toEqual([1, 2]);
    expect(parseVariantsParam('1,2')).toEqual([1, 2]);
    expect(parseVariantsParam('all')).toEqual([]);
  });

  it('serializes variants to readable tokens and supports explicit all', () => {
    expect(serializeVariantsParam([1, 2])).toBe('original,reblog');
    expect(serializeVariantsParam([], { emptyToken: 'all' })).toBe('all');
  });
});
