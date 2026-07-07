/**
 * Main Application Controller
 * Handles routing, state management, and event delegation
 */

const WEDDING_TIME_ZONE = 'America/Chicago';
const DEFAULT_WEDDING_DATE = '2026-08-30';
const DEFAULT_WEDDING_TIME = 'T10:00:00-05:00';
const DEFAULT_DATE_ONLY_TIME = 'T12:00:00Z';

function parseCentralDate(value, fallback = null, dateOnlyTime = DEFAULT_DATE_ONLY_TIME) {
  const dateValue = value || fallback;
  if (!dateValue) return new Date(NaN);

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);

  if (dateOnlyMatch) {
    return new Date(`${dateValue}${dateOnlyTime}`);
  }

  return new Date(dateValue);
}

function formatCentralDate(value, locale = 'en-US', options = {}) {
  const date = value instanceof Date ? value : parseCentralDate(value);
  return date.toLocaleDateString(locale, { ...options, timeZone: WEDDING_TIME_ZONE });
}

if (typeof window !== 'undefined') {
  window.parseCentralDate = parseCentralDate;
  window.formatCentralDate = formatCentralDate;
}

class WeddingPlanningApp {
  constructor() {
    this.currentPage = 'dashboard';
    this.wedding = null;
    this.guests = [];
    this.tasks = [];
    this.budget = [];
    this.vendors = [];
    this.venues = [];
    this.foods = [];
    this.timeline = [];
    this.syncInterval = null;

    this.init();
  }

  // Initialize app
  async init() {
    this.loadDashboard();
    this.setupRouting();
    this.startPollingSync();
  }

  // Load dashboard and fetch data
  async loadDashboard() {
    try {
      // Fetch wedding config
      const weddingRes = await this.apiCall('/api/wedding', 'GET');
      this.wedding = weddingRes;

      // Fetch all data
      await this.fetchAllData();

      // Render dashboard
      this.renderDashboard();
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      this.showError('Failed to load dashboard');
    }
  }

  // Fetch all data from APIs
  async fetchAllData() {
    try {
      const [guestsRes, tasksRes, budgetRes, vendorsRes, venuesRes, foodRes, timelineRes] =
        await Promise.all([
          this.apiCall('/api/guests', 'GET').catch(() => ({ guests: [] })),
          this.apiCall('/api/tasks', 'GET').catch(() => ({ tasks: [] })),
          this.apiCall('/api/budget?action=items', 'GET').catch(() => ({ items: [] })),
          this.apiCall('/api/vendors', 'GET').catch(() => []),
          this.apiCall('/api/venues', 'GET').catch(() => []),
          this.apiCall('/api/food', 'GET').catch(() => []),
          this.apiCall('/api/timeline', 'GET').catch(() => []),
        ]);

      // Extract arrays from response objects
      this.guests   = Array.isArray(guestsRes)   ? guestsRes   : (guestsRes.guests   || []);
      this.tasks    = Array.isArray(tasksRes)    ? tasksRes    : (tasksRes.tasks     || []);
      this.budget   = Array.isArray(budgetRes)   ? budgetRes   : (budgetRes.items    || []);
      this.vendors  = Array.isArray(vendorsRes)  ? vendorsRes  : (vendorsRes.vendors || []);
      this.venues   = Array.isArray(venuesRes)   ? venuesRes   : (venuesRes.venues   || []);
      this.foods    = Array.isArray(foodRes)     ? foodRes     : (foodRes.items      || []);
      this.timeline = Array.isArray(timelineRes) ? timelineRes : (timelineRes.items  || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  // Setup client-side routing
  setupRouting() {
    document.addEventListener('click', (e) => {
      const navLink = e.target.closest('[data-page]');
      if (navLink) {
        e.preventDefault();
        this.navigateTo(navLink.dataset.page);
      }
    });

    // Handle hash-based routing
    window.addEventListener('hashchange', () => {
      const page = window.location.hash.slice(1) || 'dashboard';
      this.navigateTo(page);
    });

    const initialPage = window.location.hash.slice(1);
    if (initialPage) {
      this.navigateTo(initialPage);
    }
  }

  // Navigate to a page
  navigateTo(page) {
    this.currentPage = page;
    window.location.hash = page;

    // Hide all pages
    document.querySelectorAll('[data-view]').forEach(el => {
      el.style.display = 'none';
    });

    // Show selected page
    const view = document.querySelector(`[data-view="${page}"]`);
    if (view) {
      view.style.display = 'block';
      view.scrollTop = 0;

      // Initialize page-specific logic
      if (page === 'guests') {
        window.guestListPage?.init?.();
      } else if (page === 'tasks') {
        window.taskListPage?.init?.();
      } else if (page === 'budget') {
        window.budgetPage?.init?.();
      } else if (page === 'vendors') {
        window.vendorPage?.init?.();
      } else if (page === 'venues') {
        window.venuesPage?.init?.();
      } else if (page === 'food') {
        window.foodPage?.init?.();
      } else if (page === 'timeline') {
        window.timelinePage?.init?.();
      } else if (page === 'settings') {
        this.renderSettings();
      }
    }
  }

  // API call wrapper
  async apiCall(endpoint, method = 'GET', data = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const token = localStorage.getItem('authToken');
    if (token) {
      options.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(endpoint, options);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  parseWeddingDate(value) {
    return parseCentralDate(value, DEFAULT_WEDDING_DATE, DEFAULT_WEDDING_TIME);
  }

  formatWeddingDate(date) {
    return formatCentralDate(date, 'en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  // Render main dashboard
  renderDashboard() {
    const mainContent = document.querySelector('[data-view="dashboard"]');
    if (!mainContent) return;

    const confirmedCount = this.guests.filter(g => g.rsvpStatus === 'accepted').length;
    const totalGuests = this.guests.length;
    const tasksDone = this.tasks.filter(t => t.status === 'completed').length;
    const totalTasks = this.tasks.length;
    const budgetSpent = this.budget.reduce((sum, b) => sum + (b.actual || 0), 0);
    const budgetTotal = this.budget.reduce((sum, b) => sum + (b.budgeted || 0), 0);
    const vendorsConfirmed = this.vendors.filter(v => v.status === 'confirmed').length;
    const totalVendors = this.vendors.length;

    const weddingDate = this.parseWeddingDate(this.wedding && this.wedding.weddingDate);
    const now = new Date();
    const diff = weddingDate - now;
    const daysLeft = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    const hoursLeft = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
    const minutesLeft = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));

    const weddingDateStr = this.formatWeddingDate(weddingDate);
    const location = (this.wedding && this.wedding.location) || 'Osage House, 243 Pace Ln, Cave Springs, AR 72718';
    const coupleName = (this.wedding && this.wedding.coupleName) || 'Akhila & Akshay';

    mainContent.innerHTML = `
      <div class="dashboard-hero">
        <div class="hero-ornament">ॐ</div>
        <h1 class="hero-couple-name">${coupleName}</h1>
        <p class="hero-tagline">${weddingDateStr} &nbsp;·&nbsp; ${location}</p>
        <div class="hero-divider"><span></span><span class="hero-diamond">◆</span><span></span></div>
        <div class="hero-countdown">
          <div class="countdown-item">
            <span class="countdown-number">${daysLeft}</span>
            <span class="countdown-label">Days</span>
          </div>
          <div class="countdown-sep">:</div>
          <div class="countdown-item">
            <span class="countdown-number">${String(hoursLeft).padStart(2,'0')}</span>
            <span class="countdown-label">Hours</span>
          </div>
          <div class="countdown-sep">:</div>
          <div class="countdown-item">
            <span class="countdown-number">${String(minutesLeft).padStart(2,'0')}</span>
            <span class="countdown-label">Mins</span>
          </div>
        </div>
        <p class="hero-subtitle">until the big day</p>
      </div>

      <div class="dashboard-grid">
        <div class="stat-card" onclick="app.navigateTo('guests')">
          <div class="stat-number">${confirmedCount}<span class="stat-total">/${totalGuests}</span></div>
          <div class="stat-label">Guests Confirmed</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${totalGuests > 0 ? (confirmedCount/totalGuests)*100 : 0}%"></div>
          </div>
          <div class="stat-sub">${totalGuests - confirmedCount} awaiting RSVP</div>
        </div>

        <div class="stat-card" onclick="app.navigateTo('tasks')">
          <div class="stat-number">${tasksDone}<span class="stat-total">/${totalTasks}</span></div>
          <div class="stat-label">Tasks Completed</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${totalTasks > 0 ? (tasksDone/totalTasks)*100 : 0}%"></div>
          </div>
          <div class="stat-sub">${totalTasks - tasksDone} tasks remaining</div>
        </div>

        <div class="stat-card" onclick="app.navigateTo('budget')">
          <div class="stat-number">$${(budgetSpent).toLocaleString('en-US',{maximumFractionDigits:0})}</div>
          <div class="stat-label">Budget Spent</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${budgetTotal > 0 ? Math.min(100,(budgetSpent/budgetTotal)*100) : 0}%"></div>
          </div>
          <div class="stat-sub">of $${(budgetTotal).toLocaleString('en-US',{maximumFractionDigits:0})} budgeted &nbsp;·&nbsp; ≈ ₹${((budgetTotal*83)/100000).toFixed(1)}L</div>
        </div>

        <div class="stat-card" onclick="app.navigateTo('vendors')">
          <div class="stat-number">${vendorsConfirmed}<span class="stat-total">/${totalVendors}</span></div>
          <div class="stat-label">Vendors Booked</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${totalVendors > 0 ? (vendorsConfirmed/totalVendors)*100 : 0}%"></div>
          </div>
          <div class="stat-sub">${totalVendors - vendorsConfirmed} still pending</div>
        </div>
      </div>

      <div class="quick-links-section">
        <h3 class="section-title">Quick Actions</h3>
        <div class="quick-links-grid">
          <a href="#guests" data-page="guests" class="quick-link-card">
            <span class="ql-label">Add Guest</span>
          </a>
          <a href="#tasks" data-page="tasks" class="quick-link-card">
            <span class="ql-label">Add Task</span>
          </a>
          <a href="#budget" data-page="budget" class="quick-link-card">
            <span class="ql-label">Track Expense</span>
          </a>
          <a href="#vendors" data-page="vendors" class="quick-link-card">
            <span class="ql-label">Add Vendor</span>
          </a>
          <a href="#venues" data-page="venues" class="quick-link-card">
            <span class="ql-label">Add Venue</span>
          </a>
          <a href="#timeline" data-page="timeline" class="quick-link-card">
            <span class="ql-label">Add Milestone</span>
          </a>
        </div>
      </div>
    `;
  }

  renderSettings() {
    const view = document.querySelector('[data-view="settings"]');
    if (!view) return;

    const wedding = this.wedding || {};
    const checks = [
      Boolean(wedding.coupleName),
      Boolean(wedding.weddingDate),
      Boolean(wedding.location && wedding.location !== 'To Be Announced'),
      this.guests.length > 0,
      this.tasks.length > 0,
      this.budget.length > 0,
      this.vendors.length > 0,
      this.venues.length > 0,
      this.foods.length > 0,
      this.timeline.length > 0
    ];
    const readiness = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    const readinessValue = document.getElementById('settingsReadinessValue');
    const readinessBar = document.getElementById('settingsReadinessBar');
    if (readinessValue) readinessValue.textContent = `${readiness}%`;
    if (readinessBar) readinessBar.style.width = `${readiness}%`;

    const coupleName = document.getElementById('coupleName');
    const weddingDate = document.getElementById('weddingDate');
    const location = document.getElementById('location');
    const currency = document.getElementById('currency');
    const lastUpdated = document.getElementById('settingsLastUpdated');

    if (coupleName) coupleName.value = wedding.coupleName || 'Akhila & Akshay';
    if (weddingDate) weddingDate.value = wedding.weddingDate || DEFAULT_WEDDING_DATE;
    if (location) location.value = wedding.location || 'Osage House, 243 Pace Ln, Cave Springs, AR 72718';
    if (currency) currency.value = wedding.currency || 'USD';
    if (lastUpdated) {
      lastUpdated.textContent = wedding.updatedAt
        ? `Synced ${formatCentralDate(wedding.updatedAt, 'en-US', { month: 'short', day: 'numeric' })}`
        : 'Default profile';
    }

    this.renderRoleList();
    this.bindSettingsForm();
  }

  renderRoleList() {
    const list = document.getElementById('plannersList');
    if (!list) return;

    const roles = [
      { name: 'Akhila', role: 'Admin', scope: 'Full control' },
      { name: 'Akshay', role: 'Admin', scope: 'Full control' },
      { name: 'Balraj', role: 'Planner', scope: 'Planning modules' },
      { name: 'Parents', role: 'Viewer', scope: 'Read-only family view' },
      { name: 'Guests', role: 'Guest', scope: 'RSVP only' }
    ];

    list.innerHTML = roles.map(person => `
      <div class="role-row">
        <div>
          <strong>${person.name}</strong>
          <span>${person.scope}</span>
        </div>
        <em>${person.role}</em>
      </div>
    `).join('');
  }

  bindSettingsForm() {
    const form = document.getElementById('weddingForm');
    if (!form || form.dataset.bound === 'true') return;

    form.dataset.bound = 'true';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const payload = {
        coupleName: document.getElementById('coupleName')?.value?.trim() || 'Akhila & Akshay',
        weddingDate: document.getElementById('weddingDate')?.value || DEFAULT_WEDDING_DATE,
        location: document.getElementById('location')?.value?.trim() || 'Osage House, 243 Pace Ln, Cave Springs, AR 72718',
        currency: document.getElementById('currency')?.value || 'USD'
      };

      try {
        this.wedding = await this.apiCall('/api/wedding', 'PUT', payload);
        this.renderDashboard();
        this.renderSettings();
        this.showSuccess('Wedding profile saved');
      } catch (error) {
        console.error('Failed to save wedding profile:', error);
        this.showError('Failed to save wedding profile');
      }
    });
  }


  // Start polling sync (5s intervals)
  startPollingSync() {
    this.syncInterval = setInterval(() => {
      this.fetchAllData();
    }, 5000);
  }

  // Stop polling
  stopPollingSync() {
    if (this.syncInterval) clearInterval(this.syncInterval);
  }

  // Show error message
  showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // Show success message
  showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // Helper: Make API calls from pages (global utility)
  openAddGuestModal() {
    const modal = document.querySelector('[data-modal="addGuest"]');
    if (modal) modal.style.display = 'flex';
  }

  openEditGuestModal(guest) {
    const modal = document.querySelector('[data-modal="editGuest"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) {
        form.querySelector('[name="name"]').value = guest.name;
        form.querySelector('[name="email"]').value = guest.email || '';
        form.querySelector('[name="phone"]').value = guest.phone || '';
        form.querySelector('[name="relationship"]').value = guest.relationship || '';
        form.querySelector('[name="partySize"]').value = guest.partySize || 1;
        form.querySelector('[name="dietary"]').value = guest.dietaryRestrictions || '';
        form.querySelector('[name="rsvpStatus"]').value = guest.rsvpStatus;
        form.querySelector('[name="notes"]').value = guest.notes || '';
      }
      modal.dataset.guestId = guest.id;
      modal.style.display = 'flex';
    }
  }

  openBulkInviteModal() {
    const modal = document.querySelector('[data-modal="bulkInvite"]');
    if (modal) modal.style.display = 'flex';
  }

  openAddTaskModal() {
    const modal = document.querySelector('[data-modal="addTask"]');
    if (modal) modal.style.display = 'flex';
  }

  openEditTaskModal(task) {
    const modal = document.querySelector('[data-modal="editTask"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) {
        form.querySelector('[name="title"]').value = task.title;
        form.querySelector('[name="category"]').value = task.category;
        form.querySelector('[name="dueDate"]').value = task.dueDate;
        form.querySelector('[name="priority"]').value = task.priority;
        form.querySelector('[name="status"]').value = task.status;
        form.querySelector('[name="notes"]').value = task.notes || '';
      }
      modal.dataset.taskId = task.id;
      modal.style.display = 'flex';
    }
  }

  openAddExpenseModal() {
    const modal = document.querySelector('[data-modal="addExpense"]');
    if (modal) modal.style.display = 'flex';
  }

  openEditExpenseModal(expense) {
    const modal = document.querySelector('[data-modal="editExpense"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) {
        form.querySelector('[name="description"]').value = expense.description;
        form.querySelector('[name="category"]').value = expense.category;
        form.querySelector('[name="budgeted"]').value = (expense.budgeted / 100000).toFixed(2);
        form.querySelector('[name="actual"]').value = (expense.actual / 100000).toFixed(2);
        form.querySelector('[name="status"]').value = expense.status;
        form.querySelector('[name="vendor"]').value = expense.vendor || '';
        form.querySelector('[name="dueDate"]').value = expense.dueDate || '';
        form.querySelector('[name="notes"]').value = expense.notes || '';
      }
      modal.dataset.expenseId = expense.id;
      modal.style.display = 'flex';
    }
  }

  openAddVendorModal() {
    const modal = document.querySelector('[data-modal="addVendor"]');
    if (modal) modal.style.display = 'flex';
  }

  openEditVendorModal(vendor) {
    const modal = document.querySelector('[data-modal="editVendor"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) {
        form.querySelector('[name="name"]').value = vendor.name;
        form.querySelector('[name="category"]').value = vendor.category || '';
        form.querySelector('[name="contactName"]').value = vendor.contactName || '';
        form.querySelector('[name="email"]').value = vendor.email || '';
        form.querySelector('[name="phone"]').value = vendor.phone || '';
        form.querySelector('[name="website"]').value = vendor.website || '';
        form.querySelector('[name="eventType"]').value = vendor.eventType || '';
        form.querySelector('[name="status"]').value = vendor.status;
        form.querySelector('[name="bookedDate"]').value = vendor.bookedDate || '';
        form.querySelector('[name="serviceDate"]').value = vendor.serviceDate || '';
        form.querySelector('[name="costEstimate"]').value = vendor.costEstimate || '';
        form.querySelector('[name="costActual"]').value = vendor.costActual || '';
        form.querySelector('[name="notes"]').value = vendor.notes || '';
      }
      modal.dataset.vendorId = vendor.id;
      modal.style.display = 'flex';
    }
  }

  openInvitePlannerModal() {
    const email = window.prompt('Planner email address');
    if (!email) return;

    const role = window.prompt('Role: planner or viewer', 'planner') || 'planner';
    const token = localStorage.getItem('authToken');

    if (!token) {
      this.showError('Sign in as admin to send planner invites');
      return;
    }

    this.apiCall('/api/auth/invite-planner', 'POST', { email, role })
      .then(() => this.showSuccess('Planner invite created'))
      .catch((error) => {
        console.error('Invite planner failed:', error);
        this.showError('Failed to create planner invite');
      });
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new WeddingPlanningApp();
});

// Handle page visibility (pause sync when tab is not active)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.app?.stopPollingSync();
  } else {
    window.app?.startPollingSync();
  }
});
