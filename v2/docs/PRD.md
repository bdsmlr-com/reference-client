# BDSMLR Modular Client - Product Requirements Document

## Overview

A modular, mobile-first client-side application for browsing BDSMLR content. The application consists of 5 separate HTML pages with shared components and styling.

---

## Pages

| Page | Purpose | URL Pattern |
|------|---------|-------------|
| `search.html` | Tag-based post search | `search.html?q=tag&sort=1:0&types=2,3` |
| `archive.html` | Single blog archive (grid layout) | `archive.html?blog=name&sort=1:0&types=2,3` |
| `timeline.html` | Single blog feed (full-width cards) | `timeline.html?blog=name` |
| `activity.html` | Multi-blog aggregated feed | `activity.html` (blogs in localStorage) |
| `social.html` | Followers/Following lists | `social.html?blog=name&tab=followers` |

---

## Page Layout Comparison

| Feature | Search | Archive | Timeline | Activity | Social |
|---------|--------|---------|----------|----------|--------|
| **Input** | Tag text box | None (URL) | None (URL) | Textarea (bulk) | None (URL) |
| **Sort dropdown** | Yes | Yes | No | No | No |
| **Type pills** | Yes | Yes | Yes | Yes | No |
| **Post layout** | Grid (1/2/4 col) | Grid (1/2/4 col) | Full-width | Full-width | N/A |
| **Stats footer** | Found/Deleted/Dupes/NotFound | Loaded/Filtered | None | None | None |
| **Always chronological** | No | No | Yes | Yes | N/A |

---

## Technical Stack

| Component | Choice |
|-----------|--------|
| Build Tool | Vite |
| UI Framework | Lit (Web Components) |
| Language | TypeScript |
| Styling | Lit CSS-in-JS (scoped styles) |
| State | URL params + localStorage |
| Pages | Separate HTML files (multi-page app) |

---

## Project Structure

```
src/
├── pages/
│   ├── search.html
│   ├── archive.html
│   ├── timeline.html
│   ├── activity.html
│   └── social.html
├── scripts/
│   ├── search.ts              # Search page entry
│   ├── archive.ts             # Archive page entry
│   ├── timeline.ts            # Timeline page entry
│   ├── activity.ts            # Activity feed page entry
│   └── social.ts              # Social page entry
├── components/
│   ├── shared-nav.ts          # Navigation component
│   ├── theme-toggle.ts        # Theme switcher
│   ├── post-grid.ts           # Post card grid (for Search/Archive)
│   ├── post-card.ts           # Individual post card (grid)
│   ├── post-feed.ts           # Full-width post list (for Timeline/Activity)
│   ├── post-feed-item.ts      # Individual full-width post
│   ├── post-lightbox.ts       # Lightbox overlay
│   ├── sort-controls.ts       # Sort dropdown
│   ├── type-pills.ts          # Post type filters
│   ├── load-footer.ts         # Load more + stats
│   └── blog-list.ts           # Follower/following list (grid)
├── services/
│   ├── api.ts                 # API client
│   ├── auth.ts                # Token management
│   └── blog-resolver.ts       # Blog name abstraction layer
├── styles/
│   └── theme.ts               # CSS variables, colors
└── types/
    ├── api.ts                 # API types
    └── post.ts                # Post/media types
```

---

## Theme

### Color Scheme

**Dark Theme (default):**
```css
--bg-primary: #0f172a;      /* Dark navy */
--bg-panel: #0b1224;        /* Darker navy for cards */
--bg-panel-alt: #1e293b;    /* Lighter navy for accents */
--border: #1f2937;          /* Dark gray */
--border-strong: #334155;   /* Medium gray */
--text-primary: #e2e8f0;    /* Light slate */
--text-muted: #94a3b8;      /* Medium gray */
--accent: #38bdf8;          /* Cyan */
```

**Light Theme:**
```css
--bg-primary: #f8fafc;      /* Light slate */
--bg-panel: #ffffff;        /* White */
--bg-panel-alt: #e2e8f0;    /* Light gray */
--border: #cbd5e1;          /* Slate */
--border-strong: #94a3b8;   /* Medium slate */
--text-primary: #0f172a;    /* Dark navy */
--text-muted: #64748b;      /* Slate */
--accent: #0ea5e9;          /* Darker cyan */
```

### Theme Toggle
- Button in navigation header
- Icon: sun/moon
- Preference stored in `localStorage.bdsmlr_theme`
- Applied via `data-theme` attribute on `<html>`

---

## Responsive Design

### Breakpoints
| Name | Width | Grid Columns |
|------|-------|--------------|
| Mobile | <480px | 1 |
| Tablet | 480-768px | 2 |
| Desktop | >768px | 4 |

### Mobile-First Approach
- Base styles target mobile
- Media queries add complexity for larger screens
- Touch targets minimum 44px
- Full-width inputs on mobile

**Note:** Grid columns apply to Search, Archive, and Social pages. Timeline and Activity Feed use full-width cards at all breakpoints.

---

## Page Specifications

### 1. Search (`search.html`)

**Purpose:** Search posts by tag with filtering and sorting.

**UI Elements:**
- Search input (text field for tag query)
- Sort dropdown (10 options)
- Type filter pills (7 types + All)
- Post grid (responsive 1/2/4 columns)
- Load more button + infinite scroll toggle
- Stats footer (Found, Deleted, Dupes, Not Found)

**URL State:**
- `q`: Search query
- `sort`: Sort option (e.g., `1:0`)
- `types`: Comma-separated type IDs (e.g., `2,3,4`)

**API:** `POST /v2/public-read-api-v2/search-posts-by-tag`

---

### 2. Archive (`archive.html`)

**Purpose:** Browse a specific blog's posts in a grid layout with sorting options.

**Key Difference from Timeline:** Grid layout with sort controls. For browsing/discovering content.

**UI Elements:**
- Blog header (name, link to live blog)
- Sort dropdown
- Type filter pills
- Post grid (responsive 1/2/4 columns)
- Load more / infinite scroll
- Stats footer (Loaded, Filtered)

**URL State:**
- `blog`: Blog name (required)
- `sort`: Sort option
- `types`: Type filter

**Blog Name Resolution:**
```typescript
// services/blog-resolver.ts
export function getBlogName(): string {
  // Current: URL parameter
  const params = new URLSearchParams(window.location.search);
  return params.get('blog') || '';

  // Future: Subdomain-based
  // const subdomain = window.location.hostname.split('.')[0];
  // return subdomain !== 'www' ? subdomain : '';
}
```

**API:**
1. `POST /v2/public-read-api-v2/resolve-identifier` (blog_name → blog_id)
2. `POST /v2/public-read-api-v2/list-blog-posts`

---

### 3. Timeline (`timeline.html`)

**Purpose:** View a single blog's posts in chronological order (newest first) with full-width cards.

**Key Difference from Archive:** Full-width cards, always chronological (no sort options).

**UI Elements:**
- Blog header (name, link to live blog)
- Type filter pills (no sort dropdown)
- Full-width post cards (not grid)
- Load more / infinite scroll

**URL State:**
- `blog`: Blog name (required)
- `types`: Type filter (optional)

**Display:**
- Posts always sorted by creation date (newest first)
- Each post is full-width (single column)
- Same lightbox behavior as other views

**API:**
1. `POST /v2/public-read-api-v2/resolve-identifier` (blog_name → blog_id)
2. `POST /v2/public-read-api-v2/list-blog-posts` (with sort_field=CREATED_AT, order=DESC)

---

### 4. Activity Feed (`activity.html`)

**Purpose:** Aggregated feed from multiple blogs in chronological order.

**Key Difference from Timeline:** Multiple blogs instead of one.

**UI Elements:**
- Blog input textarea (add single or bulk)
- Blog chips (with remove buttons)
- Type filter pills (no sort dropdown)
- Full-width post cards (not grid)
- Load more / infinite scroll

**Bulk Input:**
- Accepts comma-separated blog names
- Accepts newline-separated blog names
- Validates and resolves each blog

**Storage:**
- Blog list in `localStorage.bdsmlr_activity_blogs`
- Persists across sessions

**Fetch Strategy:**
- Parallel fetch from all blogs
- Client-side merge by creation date (newest first)
- Deduplicate by post ID

**Display:**
- Posts always sorted chronologically (newest first)
- Each post shows which blog it's from
- Full-width cards (single column)

**API:** `POST /v2/public-read-api-v2/list-blog-posts` (per blog)

---

### 5. Social (`social.html`)

**Purpose:** View followers and following for a blog.

**UI Elements:**
- Blog header (name display)
- Tabs: Followers | Following
- Blog list (grid of clickable items)
- Load more

**URL State:**
- `blog`: Blog name
- `tab`: `followers` or `following`

**List Item Behavior:**
- Clicking navigates to `archive.html?blog={name}`

**API:**
- `POST /v2/public-read-api-v2/list-blog-followers`
- `POST /v2/public-read-api-v2/list-blog-following`

---

## Shared Components

### Navigation (`shared-nav.ts`)
- Present on all pages
- Links: Search | Archive | Timeline | Activity | Social
- Current page highlighted
- Theme toggle button
- Responsive (stacks on mobile)

### Post Card (`post-card.ts`) - For Grid Views
- Used in Search, Archive
- Thumbnail or type placeholder
- Blog name badge
- Post ID
- Engagement stats (likes, reblogs, comments)
- Up to 3 tags
- Click opens lightbox
- Deleted posts visually distinguished

### Post Feed Item (`post-feed-item.ts`) - For Full-Width Views
- Used in Timeline, Activity Feed
- Full-width card
- Larger media display
- Blog name prominently displayed
- Full metadata visible
- Click opens lightbox

### Blog List Item (`blog-list-item.ts`) - For Social
- Used in Social page
- Displayed in grid layout
- Blog name
- Follow date if available
- Click navigates to archive

### Lightbox (`post-lightbox.ts`)
- Full media display (image/video/audio/text)
- Metadata: blog, post ID, dates
- All tags (expandable)
- Stats buttons (fetch likes/reblogs/comments on click)
- External links (blog, post, origin for reblogs)
- Close on backdrop click or Escape

### Load Footer (`load-footer.ts`)
- Load More button
- Infinite scroll toggle
- View-specific stats display
- Loading state with progress

---

## API Client

### Authentication
- Auto-login on first request
- Token stored: `localStorage.bdsmlr_token`
- Expiry stored: `localStorage.bdsmlr_token_expiry`
- Auto-refresh on 401

### Configuration
```env
VITE_API_BASE_URL=https://api.example.com
VITE_AUTH_EMAIL=user@example.com
VITE_AUTH_PASSWORD=secret
```

### Endpoints Used
| Endpoint | Pages |
|----------|-------|
| `/auth/login` | All |
| `/v2/.../search-posts-by-tag` | Search |
| `/v2/.../resolve-identifier` | Archive, Timeline, Activity, Social |
| `/v2/.../list-blog-posts` | Archive, Timeline, Activity |
| `/v2/.../list-blog-followers` | Social |
| `/v2/.../list-blog-following` | Social |
| `/v2/.../list-post-likes` | Lightbox |
| `/v2/.../list-post-reblogs` | Lightbox |
| `/v2/.../list-post-comments` | Lightbox |
| `/v2/.../sign-url` | All (media signing) |

---

## Build Configuration

### Vite Multi-Page Setup
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        search: resolve(__dirname, 'src/pages/search.html'),
        archive: resolve(__dirname, 'src/pages/archive.html'),
        timeline: resolve(__dirname, 'src/pages/timeline.html'),
        activity: resolve(__dirname, 'src/pages/activity.html'),
        social: resolve(__dirname, 'src/pages/social.html'),
      },
    },
  },
});
```

### Output
```
dist/
├── search.html
├── archive.html
├── timeline.html
├── activity.html
├── social.html
└── assets/
    ├── search-[hash].js
    ├── archive-[hash].js
    ├── timeline-[hash].js
    ├── activity-[hash].js
    ├── social-[hash].js
    └── shared-[hash].js
```

---

## Deduplication Strategy

**Post Deduplication:**
1. Track seen post IDs in Set
2. Track seen media URLs (normalized) in Set
3. Skip duplicates, increment counter

**Activity Feed Merge:**
1. Fetch from all blogs in parallel
2. Merge arrays by `createdAtUnix` descending
3. Deduplicate by post ID

---

## Error Handling

| Error | Handling |
|-------|----------|
| Network error | Display message, allow retry |
| API timeout (15s) | Display timeout message |
| Invalid blog name | "Blog not found" message |
| Auth failure | Auto-refresh token, retry |
| Invalid response | Log error, show generic message |

---

## Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | <2s on 3G |
| Time to Interactive | <3s on 3G |
| Bundle Size (gzip) | <50KB per page |
| Search to Results | <3s |

---

## Future Enhancements

### FE-1: Real-time Activity Feed
- WebSocket subscription API
- Server pushes new posts
- Client updates feed automatically

### FE-2: Domain-Based Archive
- Replace `archive.html?blog=name` with `name.site.com`
- Update `blog-resolver.ts` to read from hostname

---

## Success Criteria

1. All 5 pages load and function correctly
2. Theme toggle works and persists
3. Responsive grid displays correctly at all breakpoints (Search, Archive, Social)
4. Full-width cards display correctly (Timeline, Activity)
5. API calls succeed for known-good data
6. Lightbox displays all media types
7. Navigation works between all pages
8. URL state persists on refresh
9. QA plan test cases pass
