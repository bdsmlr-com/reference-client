# BDSMLR Client - User Stories

## Overview

This document defines user stories for the modular BDSMLR client. Each story follows the format:
**As a [user], I want to [action], so that [benefit].**

---

## Pages

The application consists of 5 separate HTML pages:
1. `search.html` - Tag-based search (grid layout)
2. `archive.html` - Single blog archive browser (grid layout, sortable)
3. `timeline.html` - Single blog chronological feed (full-width cards)
4. `activity.html` - Multi-blog aggregated feed (full-width cards)
5. `social.html` - Followers/Following tabs (grid of blog items)

---

## Page Layout Summary

| Page | Blog Source | Post Layout | Sort Controls |
|------|-------------|-------------|---------------|
| Search | Tag query | Grid (1/2/4 col) | Yes |
| Archive | URL param | Grid (1/2/4 col) | Yes |
| Timeline | URL param | Full-width | No (chronological) |
| Activity | Textarea input | Full-width | No (chronological) |
| Social | URL param | Grid of blogs | No |

---

## Theme

**Color Scheme** (from daddy-and-his-baby-girl.bdsmlr.com/newhome):

**Dark Theme (default):**
- Background: `#0f172a` (dark navy)
- Panel: `#0b1224` (darker navy for cards)
- Panel-2: `#1e293b` (lighter navy for accents)
- Border: `#1f2937` (dark gray)
- Border-strong: `#334155` (medium gray)
- Text: `#e2e8f0` (light slate)
- Text-muted: `#94a3b8` (medium gray)
- Accent: `#38bdf8` (cyan)

**Light Theme:**
- Background: `#f8fafc` (light slate)
- Panel: `#ffffff` (white)
- Panel-2: `#e2e8f0` (light gray)
- Border: `#cbd5e1` (slate)
- Border-strong: `#94a3b8` (medium slate)
- Text: `#0f172a` (dark navy)
- Text-muted: `#64748b` (slate)
- Accent: `#0ea5e9` (darker cyan for contrast)

---

## Responsive Breakpoints

- Mobile: 1 column (<480px)
- Tablet: 2 columns (480-768px)
- Desktop: 4 columns (>768px)

**Note:** Grid columns apply to Search, Archive, and Social. Timeline and Activity use full-width cards at all breakpoints.

---

## Epic 1: Search

### US-1.1: Tag Search
**As a** user
**I want to** search for posts by tag
**So that** I can find content related to my interests

**Acceptance Criteria:**
- [ ] Text input for tag query
- [ ] Boolean search support: `AND` (space), `NOT` (-prefix), `"literal phrase"`, `(groups)`
- [ ] Results displayed in a responsive grid (1/2/4 columns)
- [ ] Mobile-first design

### US-1.2: Search Sorting
**As a** user
**I want to** sort search results by different criteria
**So that** I can find the most relevant content

**Acceptance Criteria:**
- [ ] Dropdown with sort options: Newest, Oldest, Most/Least popular, Most/Least reblogged, Most/Least liked, Most/Least commented
- [ ] Changing sort re-executes search
- [ ] Sort preference persists in URL (`?sort=1:0`)

### US-1.3: Post Type Filtering
**As a** user
**I want to** filter search results by post type
**So that** I can focus on specific content formats

**Acceptance Criteria:**
- [ ] Toggle pills for: Image, Video, Text, Audio, Link, Chat, Quote
- [ ] "All" toggle to select/deselect all types
- [ ] At least one type must be selected
- [ ] Filter preference persists in URL (`?types=2,3`)

### US-1.4: Search Results Display
**As a** user
**I want to** see search results as visual cards in a grid
**So that** I can quickly browse content

**Acceptance Criteria:**
- [ ] Each card shows: thumbnail (or type placeholder), blog name, post ID, engagement stats, up to 3 tags
- [ ] Cards are clickable to open lightbox
- [ ] Deleted/redacted posts are visually distinguished
- [ ] External links open in new tab

### US-1.5: Load More / Infinite Scroll
**As a** user
**I want to** load more results progressively
**So that** I don't wait for all results upfront

**Acceptance Criteria:**
- [ ] "Load More" button loads next batch (default)
- [ ] Optional infinite scroll toggle
- [ ] Loading state shown during fetch
- [ ] "No more results" message when exhausted

### US-1.6: Search Statistics
**As a** user
**I want to** see statistics about my search
**So that** I understand the data quality

**Acceptance Criteria:**
- [ ] Display counts: Found, Deleted, Duplicates, Not Found
- [ ] Stats update in real-time during loading

---

## Epic 2: Archive

### US-2.1: Blog Archive Browser
**As a** user
**I want to** browse all posts from a specific blog in a grid layout
**So that** I can explore and discover a creator's content

**Acceptance Criteria:**
- [ ] Blog name extracted from URL (`archive.html?blog=canadiandominant`)
- [ ] NO text input box - blog name comes from URL only
- [ ] Blog name resolved to blog ID via API
- [ ] Error message if blog not found
- [ ] Blog header shows name and link to live blog
- [ ] Posts displayed in responsive grid (1/2/4 columns)

**Implementation Note:**
Create a proxy/abstraction layer for getting blog name from URL. In production, this will be replaced with domain-based routing (`blogname.site.com`). The proxy should be easy to swap out.

```typescript
// Current implementation (URL param)
function getBlogName(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('blog') || '';
}

// Future implementation (domain-based)
function getBlogName(): string {
  const subdomain = window.location.hostname.split('.')[0];
  return subdomain;
}
```

### US-2.2: Archive Sorting & Filtering
**As a** user
**I want to** sort and filter archive posts
**So that** I can find specific content

**Acceptance Criteria:**
- [ ] Same sort options as Search
- [ ] Same post type filters as Search
- [ ] Preferences persist in URL

### US-2.3: Archive Display
**As a** user
**I want to** see archive posts in a grid
**So that** I can browse visually

**Acceptance Criteria:**
- [ ] Same card format as Search (grid layout)
- [ ] Same lightbox behavior
- [ ] Same load more/infinite scroll
- [ ] Stats footer shows: Loaded, Filtered

---

## Epic 3: Timeline

### US-3.1: Single Blog Chronological Feed
**As a** user
**I want to** view a single blog's posts in chronological order
**So that** I can see their content as a timeline

**Acceptance Criteria:**
- [ ] Blog name from URL (`timeline.html?blog=canadiandominant`)
- [ ] NO sort dropdown - always chronological (newest first)
- [ ] Posts displayed as full-width cards (not grid)
- [ ] Blog header shows name

### US-3.2: Timeline Display
**As a** user
**I want to** see timeline posts as full-width cards
**So that** I can focus on one post at a time

**Acceptance Criteria:**
- [ ] Posts always sorted by creation date (newest first)
- [ ] Full-width card layout (single column at all breakpoints)
- [ ] Larger media display than grid cards
- [ ] Same lightbox behavior as other views
- [ ] Load more / infinite scroll

### US-3.3: Timeline Filtering
**As a** user
**I want to** filter timeline by post type
**So that** I can focus on specific content

**Acceptance Criteria:**
- [ ] Post type filter pills (same as Search/Archive)
- [ ] NO sort dropdown
- [ ] Filter applies to the feed

---

## Epic 4: Activity Feed

### US-4.1: Multi-Blog Feed
**As a** user
**I want to** create a combined feed from multiple blogs
**So that** I can follow multiple creators in one view

**Acceptance Criteria:**
- [ ] Text input/textarea to add blog names
- [ ] Bulk input support (comma-separated, newline-separated)
- [ ] List of currently followed blogs (removable chips)
- [ ] Combined chronological feed from all blogs
- [ ] Blog list persists in localStorage across sessions

### US-4.2: Activity Feed Display
**As a** user
**I want to** see activity feed posts as full-width cards
**So that** I can see the latest content from all my followed blogs

**Acceptance Criteria:**
- [ ] Posts sorted by creation date (newest first) - NO sort dropdown
- [ ] Each post clearly shows which blog it's from
- [ ] Full-width card layout (same as Timeline)
- [ ] Load more / infinite scroll

### US-4.3: Activity Feed Filtering
**As a** user
**I want to** filter activity feed by post type
**So that** I can focus on specific content

**Acceptance Criteria:**
- [ ] Same post type filters as Timeline
- [ ] Filter applies across all blogs in feed

### US-4.4: Activity Feed API Strategy
**As a** developer
**I want to** efficiently fetch posts from multiple blogs
**So that** the application performs well

**Acceptance Criteria:**
- [ ] Parallel fetch from all blogs
- [ ] Results merged and sorted chronologically (client-side)
- [ ] Deduplicate by post ID

**Future Enhancement:** Subscription/WebSocket API for real-time updates instead of polling.

---

## Epic 5: Social (Followers/Following)

### US-5.1: Social Page Load
**As a** user
**I want to** view a blog's social connections
**So that** I can explore the community

**Acceptance Criteria:**
- [ ] Blog name from URL (`social.html?blog=canadiandominant`)
- [ ] Blog name resolved via API
- [ ] Error if blog not found

### US-5.2: Followers/Following Tabs
**As a** user
**I want to** switch between followers and following views
**So that** I can see both directions of connections

**Acceptance Criteria:**
- [ ] Two tabs: Followers, Following
- [ ] Tab state persists in URL (`?tab=followers` or `?tab=following`)
- [ ] Each tab shows list of blog names

### US-5.3: Social List Display
**As a** user
**I want to** see a grid of follower/following blogs
**So that** I can discover related accounts

**Acceptance Criteria:**
- [ ] Grid layout of blog items (responsive 1/2/4 columns)
- [ ] Each item shows blog name
- [ ] Follow date shown if available
- [ ] Load more for pagination

### US-5.4: Navigate to Archive
**As a** user
**I want to** click a follower/following to view their archive
**So that** I can explore their content

**Acceptance Criteria:**
- [ ] Each list item is clickable
- [ ] Clicking navigates to `archive.html?blog={name}`

---

## Epic 6: Lightbox

### US-6.1: Post Detail View
**As a** user
**I want to** view post details in a lightbox
**So that** I can see full content without leaving the page

**Acceptance Criteria:**
- [ ] Opens on card click (from any view)
- [ ] Shows full media (image, video, audio player, text content)
- [ ] Shows post metadata: blog name, post ID, creation date
- [ ] Shows all tags (expandable if many)
- [ ] Close on backdrop click or escape key

### US-6.2: Post Engagement Details
**As a** user
**I want to** see who liked/reblogged/commented on a post
**So that** I can discover engaged users

**Acceptance Criteria:**
- [ ] Clickable stats buttons: Likes, Reblogs, Comments
- [ ] Clicking fetches and displays list
- [ ] Each entry shows user/blog name and timestamp
- [ ] Links to user profiles

### US-6.3: External Links
**As a** user
**I want to** visit the original post or blog
**So that** I can engage on the platform

**Acceptance Criteria:**
- [ ] Link to original blog
- [ ] Link to specific post
- [ ] For reblogs: links to both origin and reblogger
- [ ] All links open in new tab

---

## Epic 7: Theming

### US-7.1: Dark/Light Theme Toggle
**As a** user
**I want to** switch between dark and light themes
**So that** I can use the app comfortably in different lighting

**Acceptance Criteria:**
- [ ] Theme toggle button visible on all pages
- [ ] Dark theme: navy background, slate text, cyan accent
- [ ] Light theme: light slate background, dark text, cyan accent
- [ ] Preference persists in localStorage across pages
- [ ] Theme applies consistently across all pages

---

## Epic 8: Mobile Experience

### US-8.1: Responsive Grid
**As a** mobile user
**I want to** see appropriate layouts on different screen sizes
**So that** content is readable and touchable

**Acceptance Criteria:**
- [ ] Grid views (Search, Archive, Social): 1 column on mobile, 2 on tablet, 4 on desktop
- [ ] Full-width views (Timeline, Activity): single column at all breakpoints
- [ ] Cards have appropriate touch targets (min 44px)

### US-8.2: Mobile Navigation
**As a** mobile user
**I want to** easily navigate between pages
**So that** I can access all features

**Acceptance Criteria:**
- [ ] Navigation visible and usable on mobile
- [ ] Links/buttons have appropriate size for touch
- [ ] Current page indicated

### US-8.3: Mobile Input
**As a** mobile user
**I want to** easily enter search terms and blog names
**So that** I can use the app on my phone

**Acceptance Criteria:**
- [ ] Input fields are full-width on mobile
- [ ] Virtual keyboard doesn't obscure critical UI
- [ ] Submit buttons are easily tappable

---

## Epic 9: Cross-Page Consistency

### US-9.1: Shared Navigation
**As a** user
**I want to** navigate between pages consistently
**So that** I can easily switch contexts

**Acceptance Criteria:**
- [ ] Navigation present on all pages
- [ ] Links to: Search, Archive, Timeline, Activity, Social
- [ ] Current page highlighted
- [ ] Theme toggle accessible from all pages

### US-9.2: URL State Persistence
**As a** user
**I want to** share/bookmark URLs that preserve my search
**So that** I can return to or share specific results

**Acceptance Criteria:**
- [ ] Search: `search.html?q=tag&sort=1:0&types=2,3`
- [ ] Archive: `archive.html?blog=name&sort=1:0&types=2,3`
- [ ] Timeline: `timeline.html?blog=name&types=2,3`
- [ ] Activity: `activity.html` (blogs in localStorage)
- [ ] Social: `social.html?blog=name&tab=followers`

---

## Future Enhancements

### FE-1: Real-time Activity Feed Updates
**As a** user
**I want to** see new posts appear automatically
**So that** I don't have to manually refresh

**Notes:**
- Implement WebSocket/subscription API endpoint
- Client subscribes to blog IDs
- Server pushes new posts in real-time
- Consider API gateway for connection management

### FE-2: Domain-Based Archive Routing
**As a** user
**I want to** access archives via subdomain
**So that** URLs are cleaner

**Notes:**
- Replace `archive.html?blog=name` with `name.site.com`
- Proxy layer already prepared for this transition
