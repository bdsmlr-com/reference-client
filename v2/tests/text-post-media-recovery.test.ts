import { describe, it, expect } from 'vitest';
import { extractMedia } from '../src/types/post.js';

describe('text post media recovery', () => {
  it('treats text posts with recovered files as image-bearing media for detail rendering', () => {
    const media = extractMedia({
      id: 869622722,
      type: 1,
      body: 'Doggo Cat',
      content: {
        html: '<p>Doggo</p><p><img src="https://cdn.example.com/dog.jpg"></p>',
        files: ['https://imgproxy.example.com/dog.jpg'],
      },
    } as any);

    expect(media.type).toBe('image');
    expect(media.url).toBe('https://imgproxy.example.com/dog.jpg');
    expect(media.text).toBe('Doggo Cat');
    expect(media.html).toBe('Doggo Cat');
  });
});
