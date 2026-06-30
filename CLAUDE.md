# Akhila & Akshay Wedding Planning Dashboard

## Project Overview

A luxury wedding planning platform built with vanilla HTML/CSS/JavaScript and Vercel serverless functions. Designed with Udaipur Fort aesthetic inspiration - classical elegance with modern minimalism.

**Key Features:**
- 7 core modules: Guest List, Tasks, Budget, Vendors, Venues, Food/Menu, Timeline
- Real-time polling sync (5-second intervals)
- JWT-based authentication with role-based access control (Admin/Planner/Viewer)
- Vercel KV storage for data persistence
- Responsive design optimized for mobile & desktop
- Scroll animations with Framer Motion

## Project Structure

```
wedding-planning/
├── .git/                          # Version control
├── index.html                     # Main dashboard entry point
├── app.js                         # Core app controller & state management
├── style.css                      # Global styles & design system
├── package.json                   # Dependencies & scripts
├── vercel.json                    # Vercel deployment config
├── .env.local.example             # Environment variables template
├── README.md                      # User-facing documentation
│
├── api/                           # Vercel serverless functions
│   ├── auth.js                    # JWT auth, login, signup, invites
│   ├── guests.js                  # Guest CRUD, RSVP tracking
│   ├── tasks.js                   # Task management & subtasks
│   ├── budget.js                  # Expense tracking & summaries
│   ├── vendors.js                 # Vendor booking & documents
│   ├── venues.js                  # Multi-venue event management
│   ├── food.js                    # Menu planning & dietary accommodations
│   └── timeline.js                # Milestones & event scheduling
│
├── lib/                           # Utility libraries
│   ├── jwt.js                     # JWT encode/decode (HS256)
│   └── kv.js                      # Vercel KV wrapper with fallback
│
├── modules/                       # Client-side state management
│   ├── api.js                     # Global fetch wrapper & notifications
│   ├── guests.js                  # Guest data module
│   ├── tasks.js                   # Task data module
│   ├── budget.js                  # Budget data module
│   ├── vendors.js                 # Vendor data module
│   ├── venues.js                  # Venue data module
│   ├── food.js                    # Menu data module
│   └── timeline.js                # Timeline data module
│
├── pages/                         # Page-specific UI logic
│   ├── guests.js                  # Guest list page
│   ├── tasks.js                   # Task board page
│   ├── budget.js                  # Budget tracker page
│   ├── vendors.js                 # Vendor page
│   ├── venues.js                  # Venue list page
│   ├── food.js                    # Food/menu planner page
│   └── timeline.js                # Timeline/calendar page
│
├── components/                    # Reusable UI components
│   ├── container-scroll.js        # Scroll animation component
│   └── animation.js               # Animation utilities
│
└── assets/                        # Static assets
    ├── images/
    │   ├── mandap-reference.jpg   # Wedding mandap inspiration
    │   └── fort-reference.jpg     # Udaipur Fort aesthetic
    └── styles/                    # Additional stylesheets
```

## Key Technologies

- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Animations**: Framer Motion
- **Backend**: Vercel Serverless Functions
- **Database**: Vercel KV (Redis)
- **Auth**: JWT (HS256)
- **Design System**: Udaipur Fort aesthetic - Gold/Royal Blue/Terracotta/Cream
- **Responsive**: Mobile-first approach

## Design System

**Colors:**
- Primary Gold: `#b8860b` (warm, regal)
- Royal Blue: `#1a3a52` (headers, primary text)
- Terracotta: `#a0644e` (accents, palace walls)
- Cream Ivory: `#f5f1e8` (main background)
- Status: Emerald `#27ae60`, Amber `#f39c12`, Crimson `#c0392b`

**Typography:**
- Headers: Cormorant Garamond Bold
- Body: Poppins Regular
- Monospace: Space Mono

**Animations:**
- Fade-in: 0.3s ease
- Scroll-triggered: Framer Motion with scroll progress
- Hover effects: translate Y(-8px) with shadow enhancement

## Development Workflow

### Setup
```bash
npm install
```

### Local Development
```bash
# Create .env.local
VERCEL_KV_REST_API_URL=your_kv_url
VERCEL_KV_REST_API_TOKEN=your_token
JWT_SECRET=your_secret
```

### File Naming Convention
- HTML: `index.html` (main)
- API Routes: `api/{feature}.js`
- Modules: `modules/{feature}.js`
- Pages: `pages/{feature}.js`
- Components: `components/{feature}.js`

### Feature Development
When adding a new feature:
1. Create API route: `api/feature.js`
2. Create module: `modules/feature.js`
3. Create page: `pages/feature.js`
4. Add HTML section: `index.html`
5. Initialize in app.js: `navigateTo()` function
6. Update script references: Add to `index.html` `<script>` section

### Git Publishing
- After making requested changes, run the relevant checks, commit the intended files, and push the branch immediately so Vercel can deploy.
- Do not leave completed local changes unpushed unless the user explicitly asks to hold them locally.

## Real-Time Sync

- **Polling Interval**: 5 seconds
- **Conflict Resolution**: Last-modified timestamp comparison
- **Optimistic UI**: Updates client immediately, syncs with server
- **Error Handling**: Graceful degradation if API unavailable

## Deployment

### Vercel
```bash
git push origin main
# Auto-deploys to Vercel
```

### Environment Variables
Set in Vercel dashboard:
- `VERCEL_KV_REST_API_URL`
- `VERCEL_KV_REST_API_TOKEN`
- `JWT_SECRET`

## Phase Status

- ✅ **Phase 1-4**: All features implemented
- 🔄 **Phase 5**: Polish & Deploy (in progress)
  - [ ] Error handling & validation
  - [ ] Mobile responsiveness testing
  - [ ] Real-time sync verification
  - [ ] Production deployment
  - [ ] Email notifications (optional)

## Users & Roles

| Role | Features | Access |
|------|----------|--------|
| Admin (Akhila, Akshay) | Full CRUD all features | Read/Write |
| Planner (Balraj, Friend) | CRUD guests/tasks/budget/vendors/venues/food/timeline | Read/Write |
| Viewer (Parents) | View all features | Read-only |
| Guest | RSVP only | RSVP button |

## Contact

**Sister**: Akhila (bride)
**Groom**: Akshay
**Planner**: Balraj (brother)
**Timeline**: 2-3 months to wedding

---

**Last Updated**: May 12, 2026
**Version**: 1.0.0 (Phase 4 Complete)
