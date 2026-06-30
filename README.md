# Akhila & Akshay Wedding Planning Platform

## 🎨 Features

### Core Features (7 Modules)
- **👥 Guest List** - RSVP tracking, contact management, dietary preferences
- **✓ Task Board** - Categorized checklists with due dates and assignees
- **💰 Budget Tracker** - Expense tracking by category with summary analytics
- **🏢 Vendor Manager** - Contact info, booking status, document management
- **📍 Venue List** - Multiple venues for ceremony, rehearsal, pre-wedding, sangeet, reception
- **🍽️ Food & Menu** - Menu planning with dietary accommodations per guest
- **📅 Timeline** - Wedding milestones and event scheduling

### User Management
- **Role-based Access Control**
  - Admins (Akhila & Akshay): Full read/write access
  - Planners (Balraj & friend): Read/write guests, tasks, budget, vendors
  - Viewers (Parents): Read-only access
- JWT-based authentication
- Email-based invite system for planners

### Design
- **Color Palette**: Gold (#b8860b), Royal Blue (#1a3a52), Terracotta (#a0644e), Cream (#f5f1e8)
- **Animations**: Rolling parallax background, smooth hover effects, scroll indicators
- **Responsive**: Mobile-first design for all screen sizes

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (for Vercel CLI)
- Vercel account (for deployment)
- Vercel KV storage (optional, falls back to in-memory)

### Local Development

1. **Clone and setup**
```bash
cd "C:\Users\balra\Claude local"
npm install
```

2. **Create environment file**
```bash
cp .env.local.example .env.local
```

3. **Configure environment variables**
Edit `.env.local` with your Vercel KV credentials:
```
VERCEL_KV_REST_API_URL=https://your-kv-store.kv.vercel-storage.com
VERCEL_KV_REST_API_TOKEN=your_token_here
JWT_SECRET=your_jwt_secret_minimum_32_chars
```

4. **Start development server**
```bash
npm run dev
```

Access at `http://localhost:3000`

### Deployment to Vercel

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Deploy**
```bash
npm run deploy
```

3. **Configure environment variables in Vercel dashboard**
- Add the three env vars from `.env.local.example`

## 📁 Project Structure

```
wedding-planning/
├── index.html                    # Rolling homepage
├── dashboard.html                # Main dashboard UI
├── app.js                        # Core app logic & routing
├── style.css                     # Complete design system
│
├── api/
│   ├── auth.js                   # Authentication endpoints
│   ├── wedding.js                # Wedding config CRUD
│   ├── guests.js                 # Guest management
│   ├── tasks.js                  # Task CRUD
│   ├── budget.js                 # Budget tracking
│   ├── vendors.js                # Vendor management
│   ├── venues.js                 # Venue management
│   ├── food.js                   # Menu planning
│   ├── timeline.js               # Timeline/milestones
│   ├── users.js                  # Planner management
│   └── _middleware.js            # JWT verification
│
├── modules/
│   ├── api.js                    # Fetch wrapper
│   ├── guests.js                 # Guest logic
│   ├── tasks.js                  # Task logic
│   ├── budget.js                 # Budget logic
│   ├── vendors.js                # Vendor logic
│   ├── venues.js                 # Venue logic
│   ├── food.js                   # Food logic
│   ├── timeline.js               # Timeline logic
│   └── sync.js                   # Real-time polling
│
├── lib/
│   ├── jwt.js                    # JWT utilities
│   ├── kv.js                     # Vercel KV wrapper
│   └── env.js                    # Env variables
│
├── pages/
│   ├── dashboard.js              # Dashboard logic
│   ├── guests.js                 # Guest list logic
│   ├── budget.js                 # Budget page logic
│   ├── tasks.js                  # Task board logic
│   ├── vendors.js                # Vendor page logic
│   ├── venues.js                 # Venue page logic
│   ├── food.js                   # Food page logic
│   ├── timeline.js               # Timeline page logic
│   └── settings.js               # Settings logic
│
├── vercel.json                   # Vercel configuration
├── package.json                  # Dependencies
└── .env.local.example            # Environment template
```

## 🔐 Authentication Flow

### Signup (First Time)
1. Bride (Akhila) or Groom (Akshay) creates wedding account
2. Provide couple name, wedding date, password
3. Receive JWT token → Dashboard access

### Invite Planner
1. Admin sends email invite to planner
2. Invite link contains temporary token
3. Planner clicks link, creates password
4. Planner gets account with assigned role

### Login
1. Enter email + password
2. Receive JWT token (valid 7 days)
3. Token stored in localStorage
4. Auto-logout on expiration

## 📊 Data Model

All data stored in Vercel KV (Redis-compatible):

- **Wedding**: Couple info, date, budget, currency
- **Users**: Admin, planners, viewers with roles
- **Guests**: RSVP status, dietary needs, contact info
- **Tasks**: Categorized checklists with assignees
- **Budget**: Expenses by category, payment status
- **Vendors**: Contact, booking status, documents
- **Venues**: Multiple event locations, capacities, costs
- **Foods**: Menu items with dietary modifications
- **Timeline**: Milestones, event dates, reminders

## 🔄 Real-Time Sync

- **Polling every 5 seconds** from server
- **Optimistic UI updates** (update locally first)
- **Conflict detection** using last-modified timestamps
- **Toast notifications** for remote changes
- Pauses when browser tab is inactive

## 🎯 Implementation Status

### Phase 1: Foundation ✅
- [x] Git setup & Vercel config
- [x] Rolling homepage with Udaipur Fort parallax
- [x] JWT authentication system
- [x] Dashboard HTML structure
- [x] Complete CSS design system
- [x] App routing & state management

### Phase 2: Guest Management (In Progress)
- [x] Guest CRUD API (`/api/guests`)
- [x] Guest list page with table/search/filters
- [x] Add/edit guest modals
- [x] Bulk invite functionality
- [x] CSV export endpoint
- [ ] Email integration (Resend for invitations, Gmail for RSVP confirmations)
- [ ] Mobile responsive testing

### Phase 3: Tasks & Budget (Complete ✅)
- [x] Task CRUD API with categories, assignees, priorities, subtasks
- [x] Task board with Kanban view (Pending → In Progress → Completed)
- [x] List view toggle for tasks
- [x] Budget CRUD API with category breakdown
- [x] Budget tracker with summary cards
- [x] Category breakdown by budgeted/actual/status
- [x] Expense tracking with payment status
- [x] CSV export for both tasks and expenses

### Phase 4: Vendors & Timeline
- [ ] Vendor CRUD API
- [ ] Venue CRUD API
- [ ] Food/Menu CRUD API
- [ ] Timeline/Calendar page
- [ ] Document upload

### Phase 5: Polish & Deploy
- [ ] Multi-user conflict resolution
- [ ] Error handling & validation
- [ ] Mobile testing
- [ ] Production deployment

## 🛠️ Technology Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Vercel KV (Redis)
- **Auth**: JWT (HS256)
- **Deployment**: Vercel
- **Typography**: Cormorant Garamond, Poppins
- **No external dependencies** (zero npm packages)

## 📝 Environment Variables

Required for production:
```
VERCEL_KV_REST_API_URL    # Vercel KV endpoint
VERCEL_KV_REST_API_TOKEN  # Vercel KV token
JWT_SECRET                # Minimum 32 characters
RSVP_SECRET               # Signs guest-specific RSVP links

# Optional
RESEND_API_KEY            # Optional: sends formal bulk invitation emails
INVITE_FROM_EMAIL         # Optional: verified Resend sender address for bulk invitations
SITE_URL                  # Optional: base URL used in email/token RSVP links
RSVP_SITE_URL             # Optional: standalone public RSVP URL used in invitations
TWILIO_ACCOUNT_SID        # Twilio account ID for RSVP confirmation SMS
TWILIO_AUTH_TOKEN         # Twilio API secret for RSVP confirmation SMS
TWILIO_FROM_NUMBER        # One US Twilio sender number, in +15551234567 format
WEDDING_TIMEZONE          # Calendar timezone, defaults to America/Chicago
COMMON_EVENT_ADDRESS      # Shared address for events that are still to be confirmed
SANGEETH_EVENT_ADDRESS    # Sangeeth venue address
SANGEETH_MAP_URL          # Sangeeth map link
PELLIKUTHURU_ADDRESS      # Pellikuthuru / Pellikoduku venue address
PELLIKUTHURU_MAP_URL      # Pellikuthuru / Pellikoduku map link
MARRIAGE_ADDRESS          # Marriage venue address
MARRIAGE_MAP_URL          # Marriage map link
```

The standalone public RSVP route is `https://akhila-akshay-rsvp.vercel.app/`; share it directly on WhatsApp. Set `RSVP_SITE_URL` to this value in the private dashboard's Vercel Production environment so formal invitations send guest-specific links to the same site. It works with Vercel KV alone—guests do not need a Resend account or an email invitation. The public form asks for name, phone, and email, updates a uniquely matched guest, or creates a new guest when no match exists.

`INVITE_FROM_EMAIL` is only needed for formal bulk email invitations from the dashboard. It should be an email sender, not only a display name. For testing without a domain, `onboarding@resend.dev` can only send to the Resend account owner's email address. Real invitation delivery to all guests requires a domain verified in Resend, then a value like `Akhila and Akshay <invites@yourdomain.com>`.

After a guest submits a final RSVP, the system sends a detailed email confirmation through Gmail and a concise SMS confirmation through Twilio. Add the same Gmail and Twilio environment variables to both the private dashboard and standalone public RSVP Vercel projects. Notification delivery failures are recorded without discarding the RSVP.

## 🚨 Notes

- **Development**: Uses in-memory KV fallback if env vars not set
- **RSVP**: The standalone public RSVP site and `rsvp.html` have the same RSVP form and flow: Yes/Maybe/No responses, per-event attendee and meal counts, guest-specific invited events, and Apple Calendar `.ics` downloads for signed links.
- **Catering totals**: The Food page calculates confirmed attendees and meal counts per event from the latest RSVP responses; Maybe responses are shown separately and are not included in meal totals.
- **Guest Events**: Guest rows can select invited events individually. CSV import accepts an `Events`, `Invited Events`, or `Events Invited To` column with values like `All Events`, `Haldi + Sangeet`, or `Marriage|Satyanarayana Swamy Vratam`
- **Guest Side**: Akhila/Akshay side only changes Pellikuthuru/Pellikoduku details and addresses; all other events use the common address
- **Security**: Never commit `.env.local` or `.env.*.local`
- **Polling**: 5-second sync interval is suitable for wedding planning
- **Scaling**: Vercel KV has limits; fine for single wedding (thousands of guests)

## 📧 Support

For issues or questions:
- Check the implementation plan in `/claude/plans/`
- Review API endpoint documentation
- Test locally with `npm run dev`

## 📄 License

MIT License - Created for Akhila & Akshay's wedding planning 💍

---

**Built with elegance and care** ✨
