import { describe, expect, it } from 'vitest';
import {
  buildRelatedPerspectiveTabs,
  relatedPerspectiveHref,
  relatedPerspectiveLabel,
  selectDefaultRelatedPerspective,
  type RelatedPerspective,
  type RelatedPerspectiveSet,
} from '../src/services/related-perspective.js';

const viewer: RelatedPerspective = {
  role: 'viewer',
  blogName: 'bdsmlrstaff',
  blogId: 10,
};
const original: RelatedPerspective = {
  role: 'original',
  blogName: 'AwesomeMrandMrsGrey',
  blogId: 20,
};
const reblogger: RelatedPerspective = {
  role: 'reblogger',
  blogName: 'ExampleReblogger',
  blogId: 30,
};

function perspectiveSet(overrides: Partial<RelatedPerspectiveSet> = {}): RelatedPerspectiveSet {
  return {
    authenticated: true,
    viewer: { ...viewer },
    original: { ...original },
    reblogger: { ...reblogger },
    isReblog: true,
    ...overrides,
  };
}

describe('selectDefaultRelatedPerspective', () => {
  it('selects the viewer for an authenticated request', () => {
    expect(selectDefaultRelatedPerspective(perspectiveSet())).toEqual(viewer);
  });

  it('selects the original blog for an anonymous original post', () => {
    expect(selectDefaultRelatedPerspective(perspectiveSet({ authenticated: false, isReblog: false })))
      .toEqual(original);
  });

  it('selects the reblogger for an anonymous reblog', () => {
    expect(selectDefaultRelatedPerspective(perspectiveSet({ authenticated: false })))
      .toEqual(reblogger);
  });

  it('falls back to a new original perspective when an anonymous reblogger is missing', () => {
    const input = perspectiveSet({ authenticated: false, reblogger: undefined });

    expect(selectDefaultRelatedPerspective(input)).toEqual({
      ...original,
      fallbackApplied: true,
    });
    expect(input.original).toEqual(original);
  });

  it('does not cross perspectives when an authenticated viewer is unresolved', () => {
    expect(selectDefaultRelatedPerspective(perspectiveSet({
      viewer: undefined,
    }))).toBeUndefined();
    expect(selectDefaultRelatedPerspective(perspectiveSet({
      viewer: { ...viewer, blogName: '   ' },
    }))).toBeUndefined();
  });

  it('falls back from an invalid anonymous reblogger identity', () => {
    expect(selectDefaultRelatedPerspective(perspectiveSet({
      authenticated: false,
      reblogger: { ...reblogger, blogName: '\t' },
    }))).toEqual({ ...original, fallbackApplied: true });
  });
});

describe('buildRelatedPerspectiveTabs', () => {
  it('orders usable perspectives as viewer, original, reblogger', () => {
    expect(buildRelatedPerspectiveTabs(perspectiveSet()).map(({ role }) => role)).toEqual([
      'viewer',
      'original',
      'reblogger',
    ]);
  });

  it('omits viewer when anonymous and reblogger when the post is not a reblog', () => {
    expect(buildRelatedPerspectiveTabs(perspectiveSet({
      authenticated: false,
      isReblog: false,
    }))).toEqual([original]);
  });

  it('collapses duplicate positive blog IDs and retains the first role', () => {
    const tabs = buildRelatedPerspectiveTabs(perspectiveSet({
      original: { ...original, blogId: viewer.blogId },
    }));

    expect(tabs.map(({ role }) => role)).toEqual(['viewer', 'reblogger']);
  });

  it('collapses duplicate normalized names when positive IDs are unavailable', () => {
    const tabs = buildRelatedPerspectiveTabs(perspectiveSet({
      viewer: { ...viewer, blogId: 0, blogName: '  AwesomeMrandMrsGrey  ' },
      original: { ...original, blogId: -1, blogName: 'awesomemrandmrsgrey' },
    }));

    expect(tabs.map(({ role }) => role)).toEqual(['viewer', 'reblogger']);
  });

  it('omits unusable identities and does not mutate its input', () => {
    const input = perspectiveSet({
      viewer: { ...viewer, blogId: Number.NaN },
      reblogger: { ...reblogger, blogName: '' },
    });
    const before = structuredClone(input);

    expect(buildRelatedPerspectiveTabs(input).map(({ role }) => role)).toEqual(['viewer', 'original']);
    expect(input).toEqual(before);
  });
});

describe('related perspective presentation', () => {
  it('labels each role with its concrete blog name', () => {
    expect(relatedPerspectiveLabel(viewer)).toBe('Your perspective (@bdsmlrstaff)');
    expect(relatedPerspectiveLabel(original)).toBe('Original blog (@AwesomeMrandMrsGrey)');
    expect(relatedPerspectiveLabel(reblogger)).toBe('Reblogger (@ExampleReblogger)');
  });

  it('trims concrete blog names in labels', () => {
    expect(relatedPerspectiveLabel({ ...viewer, blogName: '  bdsmlrstaff\t' }))
      .toBe('Your perspective (@bdsmlrstaff)');
    expect(relatedPerspectiveLabel({ ...original, blogName: '\n AwesomeMrandMrsGrey ' }))
      .toBe('Original blog (@AwesomeMrandMrsGrey)');
    expect(relatedPerspectiveLabel({ ...reblogger, blogName: ' ExampleReblogger  ' }))
      .toBe('Reblogger (@ExampleReblogger)');
  });

  it('uses the exact viewer route', () => {
    expect(relatedPerspectiveHref(685172617, viewer))
      .toBe('/post/685172617/related/for/you');
  });

  it('URL-encodes explicit perspective blog names', () => {
    expect(relatedPerspectiveHref(685172617, {
      ...original,
      blogName: '  Awesome Mr/Mrs Grey\t',
    })).toBe('/post/685172617/related/for/Awesome%20Mr%2FMrs%20Grey');
    expect(relatedPerspectiveHref(685172617, {
      ...reblogger,
      blogName: '\nReblogger + One ',
    })).toBe('/post/685172617/related/for/Reblogger%20%2B%20One');
  });
});
