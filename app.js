/**
 * Main Application Controller
 * Handles routing, state management, and event delegation
 */

class WeddingPlanningApp {
  constructor() {
    this.currentPage = 'dashboard';
    this.user = null;
    this.wedding = null;
    this.guests = [];
    this.tasks = [];
    this.budget = [];
    this.vendors = [];
    this.venues = [];
    this.foods = [];
    this.timeline = [];
    this.isLoggedIn = false;
    this.syncInterval = null;

    this.init();
  }

  // Initialize app
  async init() {
    this.checkAuth();
    if (this.isLoggedIn) {
      this.loadDashboard();
      this.setupRouting();
      this.startPollingSync();
    } else {
      this.showLoginPage();
    }
  }

  // Check if user is logged in
  checkAuth() {
    const token = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      this.isLoggedIn = true;
      this.user = JSON.parse(userStr);
    }
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
      [this.guests, this.tasks, this.budget, this.vendors, this.venues, this.foods, this.timeline] =
        await Promise.all([
          this.apiCall('/api/guests', 'GET').catch(e => []),
          this.apiCall('/api/tasks', 'GET').catch(e => []),
          this.apiCall('/api/budget/items', 'GET').catch(e => []),
          this.apiCall('/api/vendors', 'GET').catch(e => []),
          this.apiCall('/api/venues', 'GET').catch(e => []),
          this.apiCall('/api/food', 'GET').catch(e => []),
          this.apiCall('/api/timeline', 'GET').catch(e => []),
        ]);
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
      }
    }
  }

  // API call wrapper
  async apiCall(endpoint, method = 'GET', data = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(endpoint, options);

    if (!response.ok) {
      if (response.status === 401) {
        this.logout();
        throw new Error('Unauthorized');
      }
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
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

    mainContent.innerHTML = `
      <div class="dashboard-grid">
        <div class="stat-card">
          <div class="stat-number">${confirmedCount}/${totalGuests}</div>
          <div class="stat-label">Guests Confirmed</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${totalGuests > 0 ? (confirmedCount/totalGuests)*100 : 0}%"></div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-number">${tasksDone}/${totalTasks}</div>
          <div class="stat-label">Tasks Completed</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${totalTasks > 0 ? (tasksDone/totalTasks)*100 : 0}%"></div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-number">₹${budgetSpent}L</div>
          <div class="stat-label">Budget Spent</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${budgetTotal > 0 ? (budgetSpent/budgetTotal)*100 : 0}%"></div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-number">${this.vendors.filter(v => v.status === 'confirmed').length}/${this.vendors.length}</div>
          <div class="stat-label">Vendors Confirmed</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${this.vendors.length > 0 ? (this.vendors.filter(v => v.status === 'confirmed').length/this.vendors.length)*100 : 0}%"></div>
          </div>
        </div>
      </div>
    `;
  }

  // Show login page
  showLoginPage() {
    document.body.innerHTML = `
      <div class="login-container">
        <div class="login-card">
          <h1>Wedding Planning Platform</h1>
          <p>Akhila & Akshay</p>
          <form id="loginForm">
            <input type="email" placeholder="Email" required>
            <input type="password" placeholder="Password" required>
            <button type="submit" class="btn btn-primary">Login</button>
          </form>
          <p><a href="#signup">Create new wedding plan</a></p>
        </div>
      </div>
    `;

    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.login(e.target[0].value, e.target[1].value);
    });
  }

  // Login function
  async login(email, password) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) throw new Error('Login failed');

      const { token, user } = await response.json();
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));

      this.isLoggedIn = true;
      this.user = user;
      this.init();
    } catch (error) {
      this.showError('Login failed. Check your credentials.');
    }
  }

  // Logout function
  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    this.isLoggedIn = false;
    this.init();
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
    // TODO: Implement planner invite modal
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
