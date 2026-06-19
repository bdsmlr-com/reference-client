import { describe, it, expect } from 'vitest';
import { extractMedia } from '../src/types/post.js';

describe('text post media recovery', () => {
  it('keeps text posts as text when only legacy file recovery is present', () => {
    const media = extractMedia({
      id: 869622722,
      type: 1,
      body: 'Doggo Cat',
      content: {
        html: '<p>Doggo</p><p><img src="https://cdn.example.com/dog.jpg"></p>',
        files: ['https://imgproxy.example.com/dog.jpg'],
      },
    } as any);

    expect(media.type).toBe('text');
    expect(media.url).toBeUndefined();
    expect(media.text).toBe('Doggo Cat');
    expect(media.html).toBe('Doggo Cat');
  });
});
