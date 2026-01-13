# BDSMLR Client - QA Plan

## Overview

This document defines the QA test cases for the BDSMLR client. Tests are organized by epic and include both manual and automated test criteria.

---

## Test Environment

### Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### Viewports
- [ ] Mobile: 375px (iPhone SE)
- [ ] Mobile Large: 428px (iPhone 14 Pro Max)
- [ ] Tablet: 768px (iPad)
- [ ] Desktop: 1280px
- [ ] Desktop Large: 1920px

### Test Data
- Known good blog: `canadiandominant`
- Known good tag: `mochi`
- Blog with followers: TBD
- Blog with following: TBD

---

## Page Summary

| Page | Layout | Sort Controls | Blog Source |
|------|--------|---------------|-------------|
| Search | Grid (1/2/4 col) | Yes | Tag query |
| Archive | Grid (1/2/4 col) | Yes | URL param |
| Timeline | Full-width | No | URL param |
| Activity | Full-width | No | Textarea/localStorage |
| Social | Grid of blogs | No | URL param |

---

## Epic 1: Search Tests

### TC-1.1: Basic Tag Search
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `search.html` | Page loads with search input |
| 2 | Enter `mochi` in search field | Text appears in input |
| 3 | Click Search button | Loading state shown |
| 4 | Wait for results | Grid displays post cards |
| 5 | Verify cards have thumbnails | Images or type placeholders shown |
| 6 | Verify stats display | Found/Deleted/Dupes/NotFound counts shown |

### TC-1.2: Boolean Search
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Search for `bdsm bondage` | Results contain both tags |
| 2 | Search for `bdsm -bondage` | Results have bdsm, not bondage |
| 3 | Search for `"hot tub"` | Results have exact phrase |

### TC-1.3: Sort Options
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Search for `mochi` | Results load |
| 2 | Change sort to "Oldest" | Results reload, oldest first |
| 3 | Verify URL updated | `?sort=1:1` in URL |
| 4 | Refresh page | Sort persists from URL |

### TC-1.4: Post Type Filters
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Image" pill to deselect | Pill deactivates |
| 2 | Search or wait for reload | No image posts in results |
| 3 | Click "All" pill | All types reactivated |
| 4 | Verify URL updated | `?types=...` reflects selection |

### TC-1.5: Load More
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Search for popular tag | Results load |
| 2 | Scroll to bottom | "Load More" button visible |
| 3 | Click "Load More" | More results append to grid |
| 4 | Continue until exhausted | "No more results" shown |

### TC-1.6: Infinite Scroll
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enable infinite scroll checkbox | Checkbox checked |
| 2 | Scroll to bottom of results | More results load automatically |
| 3 | Disable checkbox | Auto-loading stops |

### TC-1.7: Grid Layout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View at 375px (mobile) | 1 column grid |
| 2 | View at 768px (tablet) | 2 column grid |
| 3 | View at 1280px (desktop) | 4 column grid |

---

## Epic 2: Archive Tests

### TC-2.1: Load Blog Archive
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `archive.html?blog=canadiandominant` | Page loads |
| 2 | Wait for API resolution | Blog name resolved to ID |
| 3 | Posts load | Grid displays blog's posts |
| 4 | Blog header shows name | "@canadiandominant" visible |
| 5 | Link to live blog works | Opens blog in new tab |

### TC-2.2: Invalid Blog
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `archive.html?blog=thisblogdoesnotexist12345` | Page loads |
| 2 | Wait for API | Error message: "Blog not found" |

### TC-2.3: Archive Sorting
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load valid blog archive | Posts load in grid |
| 2 | Change sort to "Most liked" | Posts reload sorted by likes |
| 3 | Verify URL | `?blog=name&sort=2:0` |

### TC-2.4: Archive Type Filters
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load valid blog archive | Posts load in grid |
| 2 | Select only "Video" type | Only video posts shown |

### TC-2.5: Archive Grid Layout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View at 375px (mobile) | 1 column grid |
| 2 | View at 768px (tablet) | 2 column grid |
| 3 | View at 1280px (desktop) | 4 column grid |

### TC-2.6: Archive Stats
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load blog archive | Posts load |
| 2 | Check footer stats | Shows "Loaded" and "Filtered" counts |

---

## Epic 3: Timeline Tests

### TC-3.1: Load Single Blog Timeline
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `timeline.html?blog=canadiandominant` | Page loads |
| 2 | Wait for API resolution | Blog name resolved to ID |
| 3 | Posts load | Full-width cards displayed (not grid) |
| 4 | Blog header shows name | "@canadiandominant" visible |

### TC-3.2: Timeline Always Chronological
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load timeline | Posts display |
| 2 | Verify NO sort dropdown | Sort controls not present |
| 3 | Verify order | Posts sorted newest first |

### TC-3.3: Timeline Full-Width Layout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View at 375px (mobile) | Full-width cards (1 column) |
| 2 | View at 768px (tablet) | Full-width cards (1 column) |
| 3 | View at 1280px (desktop) | Full-width cards (1 column) |

### TC-3.4: Timeline Type Filters
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load timeline | Posts display |
| 2 | Type pills present | Filter pills visible |
| 3 | Select only "Image" type | Only image posts shown |

### TC-3.5: Timeline Load More
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load timeline | Posts display |
| 2 | Scroll to bottom | "Load More" button visible |
| 3 | Click "Load More" | More posts append |

### TC-3.6: Invalid Blog Timeline
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `timeline.html?blog=invalidblog12345` | Page loads |
| 2 | Wait for API | Error message: "Blog not found" |

---

## Epic 4: Activity Feed Tests

### TC-4.1: Add Blogs to Activity Feed
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `activity.html` | Page loads with empty blog list |
| 2 | Enter `canadiandominant` in textarea | Text entered |
| 3 | Click Load/Submit button | Blog resolves and appears as chip |
| 4 | Posts from blog load | Full-width cards displayed |

### TC-4.2: Bulk Add Blogs
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter `canadiandominant, kinkyoffice` (comma-separated) | Two blogs parsed |
| 2 | Submit | Both added as chips |
| 3 | Combined feed loads | Posts from both blogs, chronologically sorted |

### TC-4.3: Newline-Separated Bulk Add
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter blogs on separate lines | Multiple blogs parsed |
| 2 | Submit | All added as chips |
| 3 | Combined feed loads | Posts merged chronologically |

### TC-4.4: Remove Blog from Activity Feed
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | With blogs in list, click remove (×) on one | Blog chip removed |
| 2 | Feed updates | Removed blog's posts no longer shown |

### TC-4.5: Activity Feed Persistence
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add blogs to activity feed | Blogs in list |
| 2 | Close browser, reopen activity.html | Blogs still in list (localStorage) |
| 3 | Clear localStorage | Blogs cleared |

### TC-4.6: Activity Feed Parallel Fetch
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add 3+ blogs | All added |
| 2 | Observe network tab | Multiple requests in parallel |
| 3 | Posts merge correctly | Chronological order (newest first) |

### TC-4.7: Activity Feed Always Chronological
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load activity feed with multiple blogs | Posts display |
| 2 | Verify NO sort dropdown | Sort controls not present |
| 3 | Verify order | Posts interleaved by date, newest first |

### TC-4.8: Activity Feed Full-Width Layout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View at any viewport | Full-width cards (1 column) |
| 2 | Each post shows blog name | Blog attribution visible |

### TC-4.9: Activity Feed Type Filters
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load activity feed | Posts display |
| 2 | Type pills present | Filter pills visible |
| 3 | Filter applies across all blogs | Only selected types from all blogs |

---

## Epic 5: Social Tests

### TC-5.1: Load Followers
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `social.html?blog=canadiandominant` | Page loads |
| 2 | "Followers" tab active by default | Followers list shown |
| 3 | List displays as grid | Blog items in grid layout |

### TC-5.2: Load Following
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Following" tab | Tab switches |
| 2 | URL updates | `?tab=following` |
| 3 | Following list loads | Different list from followers |

### TC-5.3: Navigate to Archive from Social
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click on a follower name | Navigates to archive.html |
| 2 | Archive loads for that blog | Correct blog's posts shown in grid |

### TC-5.4: Invalid Blog Social
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `social.html?blog=invalidblog12345` | Error message shown |

### TC-5.5: Social Grid Layout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View at 375px (mobile) | 1 column grid of blog items |
| 2 | View at 768px (tablet) | 2 column grid |
| 3 | View at 1280px (desktop) | 4 column grid |

---

## Epic 6: Lightbox Tests

### TC-6.1: Open Lightbox from Grid
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click on any post card in Search/Archive | Lightbox opens |
| 2 | Full media shown | Image/video/audio displayed |
| 3 | Metadata shown | Blog name, post ID, date visible |
| 4 | Tags shown | All tags displayed |

### TC-6.2: Open Lightbox from Full-Width
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click on any post in Timeline/Activity | Lightbox opens |
| 2 | Same lightbox behavior | Identical to grid lightbox |

### TC-6.3: Close Lightbox
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | With lightbox open, click backdrop | Lightbox closes |
| 2 | Reopen, press Escape | Lightbox closes |

### TC-6.4: Engagement Details
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open lightbox for post with likes | Likes button shows count |
| 2 | Click likes button | API called, list of likers shown |
| 3 | Click reblogs button | List of rebloggers shown |
| 4 | Click comments button | List of comments shown |

### TC-6.5: External Links
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click blog link in lightbox | Blog opens in new tab |
| 2 | Click post link | Post opens in new tab |

### TC-6.6: Video Playback
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click video post card | Lightbox with video player |
| 2 | Video plays | Playback works |
| 3 | Controls functional | Play/pause/seek work |

---

## Epic 7: Theme Tests

### TC-7.1: Theme Toggle
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Default theme is dark | Navy background |
| 2 | Click theme toggle | Switches to light (white background) |
| 3 | Click again | Switches back to dark |

### TC-7.2: Theme Persistence
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set theme to light | Light theme active |
| 2 | Navigate to different page | Light theme persists |
| 3 | Close browser, reopen | Light theme still active |

### TC-7.3: Theme Colors
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Dark theme | Background: #0f172a, Text: #e2e8f0, Accent: #38bdf8 |
| 2 | Light theme | Background: #f8fafc, Text: #0f172a, Accent: #0ea5e9 |

### TC-7.4: Theme on All Pages
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Toggle theme on search.html | Theme changes |
| 2 | Navigate to archive.html | Same theme |
| 3 | Navigate to timeline.html | Same theme |
| 4 | Navigate to activity.html | Same theme |
| 5 | Navigate to social.html | Same theme |

---

## Epic 8: Mobile Tests

### TC-8.1: Grid Views Responsive
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View Search at 375px | 1 column grid |
| 2 | View Archive at 375px | 1 column grid |
| 3 | View Social at 375px | 1 column grid |

### TC-8.2: Full-Width Views Responsive
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View Timeline at any viewport | Full-width cards |
| 2 | View Activity at any viewport | Full-width cards |

### TC-8.3: Touch Targets
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Inspect buttons on mobile | Min 44px height |
| 2 | Inputs easily tappable | No accidental misclicks |

### TC-8.4: Mobile Navigation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View nav on mobile | All 5 page links visible and tappable |
| 2 | Navigate between pages | Works on touch |

---

## Epic 9: Cross-Page Tests

### TC-9.1: Navigation Present
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check search.html | Nav with all 5 page links |
| 2 | Check archive.html | Nav with all 5 page links |
| 3 | Check timeline.html | Nav with all 5 page links |
| 4 | Check activity.html | Nav with all 5 page links |
| 5 | Check social.html | Nav with all 5 page links |

### TC-9.2: Current Page Highlight
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On search.html | "Search" nav item highlighted |
| 2 | On archive.html | "Archive" nav item highlighted |
| 3 | On timeline.html | "Timeline" nav item highlighted |
| 4 | On activity.html | "Activity" nav item highlighted |
| 5 | On social.html | "Social" nav item highlighted |

### TC-9.3: URL Bookmarking
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Search with filters | URL contains query params |
| 2 | Copy URL, open in new tab | Same search results |
| 3 | Archive with sort | URL preserves sort |
| 4 | Timeline with types | URL preserves types filter |

---

## API Integration Tests

### TC-API-1: Search Endpoint
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Search for `mochi` | API returns posts |
| 2 | Check response structure | Has `posts[]` and `page` |
| 3 | Verify pagination | `nextPageToken` present if more results |

### TC-API-2: Resolve Identifier
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Resolve `canadiandominant` | Returns blogId |
| 2 | Resolve invalid name | Error or empty response |

### TC-API-3: List Blog Posts
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | List posts for valid blog_id | Returns posts |
| 2 | Pagination works | Can fetch next page |

### TC-API-4: Auth Token
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fresh load, no token | Auth happens automatically |
| 2 | Token stored in localStorage | Token present |
| 3 | Token expiry | Re-auth on expiry |

### TC-API-5: Followers/Following
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | List followers | Returns activity array |
| 2 | List following | Returns activity array |

---

## Error Handling Tests

### TC-ERR-1: Network Error
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Disable network, search | Error message shown |
| 2 | Re-enable, retry | Works |

### TC-ERR-2: API Timeout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Simulate slow API (15s+) | Timeout error shown |

### TC-ERR-3: Invalid Auth
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Corrupt token in localStorage | Re-auth happens |
| 2 | API calls succeed | Token refreshed |

---

## Performance Tests

### TC-PERF-1: Initial Load
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Measure first contentful paint | < 2s on 3G |
| 2 | Time to interactive | < 3s on 3G |

### TC-PERF-2: Search Response
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Time from search click to first results | < 3s |

### TC-PERF-3: Bundle Size
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check gzipped JS size | < 50KB |

---

## Checklist Summary

### Before Release
- [ ] All TC-1.x (Search) pass
- [ ] All TC-2.x (Archive) pass
- [ ] All TC-3.x (Timeline) pass
- [ ] All TC-4.x (Activity Feed) pass
- [ ] All TC-5.x (Social) pass
- [ ] All TC-6.x (Lightbox) pass
- [ ] All TC-7.x (Theme) pass
- [ ] All TC-8.x (Mobile) pass
- [ ] All TC-9.x (Cross-Page) pass
- [ ] All TC-API-x pass
- [ ] All TC-ERR-x pass
- [ ] TC-PERF-x within targets
