/**
 * Guest List Page Logic
 * Renders guest table, search, filters, and RSVP management
 */

const guestListPage = {
  currentFilters: {
    rsvpStatus: '',
    search: '',
    dietary: '',
    sortBy: 'name',
    sortDir: 'asc'
  },

  async init() {
    this.setupEventListeners();
    await this.loadGuests();
    this.render();
  },

  setupEventListeners() {
    const guestView = document.querySelector('[data-view="guests"]');
    if (!guestView) return;

    // Search input
    const searchInput = guestView.querySelector('.guest-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentFilters.search = e.target.value;
        this.applyFilters();
      });
    }

    // RSVP status filter
    const rsvpFilter = guestView.querySelector('.guest-rsvp-filter');
    if (rsvpFilter) {
      rsvpFilter.addEventListener('change', (e) => {
        this.currentFilters.rsvpStatus = e.target.value;
        this.applyFilters();
      });
    }

    // Dietary filter
    const dietaryFilter = guestView.querySelector('.guest-dietary-filter');
    if (dietaryFilter) {
      dietaryFilter.addEventListener('change', (e) => {
        this.currentFilters.dietary = e.target.value;
        this.applyFilters();
      });
    }

    // Sort buttons
    const sortButtons = guestView.querySelectorAll('[data-sort]');
    sortButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const field = e.currentTarget.dataset.sort;
        if (this.currentFilters.sortBy === field) {
          this.currentFilters.sortDir = this.currentFilters.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.currentFilters.sortBy = field;
          this.currentFilters.sortDir = 'asc';
        }
        this.applyFilters();
      });
    });

    // Add guest button
    const addBtn = guestView.querySelector('.guest-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddGuestModal());
    }

    // Export button
    const exportBtn = guestView.querySelector('.guest-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportGuests());
    }

    // Bulk invite button
    const bulkInviteBtn = guestView.querySelector('.guest-bulk-invite-btn');
    if (bulkInviteBtn) {
      bulkInviteBtn.addEventListener('click', () => this.openBulkInviteModal());
    }
  },

  async loadGuests() {
    try {
      await guestModule.fetch(this.currentFilters);
    } catch (error) {
      showNotification('Failed to load guests', 'error');
    }
  },

  applyFilters() {
    guestModule.filter(this.currentFilters);
    this.render();
  },

  render() {
    const guestView = document.querySelector('[data-view="guests"]');
    if (!guestView) return;

    // Update stats
    this.renderStats();

    // Render table
    this.renderTable();
  },

  renderStats() {
    const guestView = document.querySelector('[data-view="guests"]');
    const statsContainer = guestView?.querySelector('.guest-stats');
    if (!statsContainer) return;

    const stats = guestModule.getSummary();

    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">Total Guests</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #27ae60;">${stats.accepted}</div>
        <div class="stat-label">Accepted</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #f39c12;">${stats.pending}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #c0392b;">${stats.declined}</div>
        <div class="stat-label">Declined</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #2a5f7f;">${stats.totalPartySize}</div>
        <div class="stat-label">Total Party Size</div>
      </div>
    `;
  },

  renderTable() {
    const guestView = document.querySelector('[data-view="guests"]');
    const tableContainer = guestView?.querySelector('.guest-table-container');
    if (!tableContainer) return;

    if (guestModule.filteredGuests.length === 0) {
      tableContainer.innerHTML = '<p class="empty-state">No guests found. Add your first guest to get started.</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'guest-table';

    // Header
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>
          <button class="sort-btn" data-sort="name">Name</button>
        </th>
        <th>Email</th>
        <th>Phone</th>
        <th>Relationship</th>
        <th>Party Size</th>
        <th>Dietary</th>
        <th>
          <button class="sort-btn" data-sort="rsvpStatus">RSVP Status</button>
        </th>
        <th>Actions</th>
      </tr>
    `;
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    guestModule.filteredGuests.forEach(guest => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${guest.name}</strong></td>
        <td>${guest.email || '-'}</td>
        <td>${guest.phone || '-'}</td>
        <td>${guest.relationship || '-'}</td>
        <td>${guest.partySize || 1}</td>
        <td><small>${guest.dietaryRestrictions || 'None'}</small></td>
        <td>
          <span class="badge badge-${guest.rsvpStatus}">
            ${guest.rsvpStatus.charAt(0).toUpperCase() + guest.rsvpStatus.slice(1)}
          </span>
        </td>
        <td>
          <button class="btn-icon edit-guest" data-id="${guest.id}" title="Edit">✎</button>
          <button class="btn-icon delete-guest" data-id="${guest.id}" title="Delete">✕</button>
        </td>
      `;

      // Edit handler
      tr.querySelector('.edit-guest').addEventListener('click', () => {
        this.openEditGuestModal(guest);
      });

      // Delete handler
      tr.querySelector('.delete-guest').addEventListener('click', () => {
        if (confirm(`Delete ${guest.name}?`)) {
          this.deleteGuest(guest.id);
        }
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    tableContainer.innerHTML = '';
    tableContainer.appendChild(table);
  },

  openAddGuestModal() {
    const modal = document.querySelector('[data-modal="addGuest"]');
    if (!modal) return;

    const form = modal.querySelector('form');
    if (form) form.reset();

    modal.style.display = 'flex';

    const submitBtn = modal.querySelector('button[type="submit"]');
    submitBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.submitAddGuest(modal);
    });
  },

  async submitAddGuest(modal) {
    const form = modal.querySelector('form');
    const data = {
      name: form.querySelector('[name="name"]')?.value,
      email: form.querySelector('[name="email"]')?.value,
      phone: form.querySelector('[name="phone"]')?.value,
      relationship: form.querySelector('[name="relationship"]')?.value,
      partySize: parseInt(form.querySelector('[name="partySize"]')?.value) || 1,
      dietaryRestrictions: form.querySelector('[name="dietary"]')?.value,
      notes: form.querySelector('[name="notes"]')?.value
    };

    if (!data.name) {
      showNotification('Guest name required', 'error');
      return;
    }

    try {
      await guestModule.addGuest(data);
      showNotification('Guest added successfully', 'success');
      modal.style.display = 'none';
      await this.loadGuests();
      this.render();
    } catch (error) {
      showNotification('Failed to add guest', 'error');
    }
  },

  openEditGuestModal(guest) {
    const modal = document.querySelector('[data-modal="editGuest"]');
    if (!modal) return;

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

    modal.style.display = 'flex';
    modal.dataset.guestId = guest.id;

    const submitBtn = modal.querySelector('button[type="submit"]');
    submitBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.submitEditGuest(modal);
    });
  },

  async submitEditGuest(modal) {
    const guestId = modal.dataset.guestId;
    const form = modal.querySelector('form');
    const data = {
      name: form.querySelector('[name="name"]')?.value,
      email: form.querySelector('[name="email"]')?.value,
      phone: form.querySelector('[name="phone"]')?.value,
      relationship: form.querySelector('[name="relationship"]')?.value,
      partySize: parseInt(form.querySelector('[name="partySize"]')?.value) || 1,
      dietaryRestrictions: form.querySelector('[name="dietary"]')?.value,
      rsvpStatus: form.querySelector('[name="rsvpStatus"]')?.value,
      notes: form.querySelector('[name="notes"]')?.value
    };

    try {
      await guestModule.updateGuest(guestId, data);
      showNotification('Guest updated successfully', 'success');
      modal.style.display = 'none';
      await this.loadGuests();
      this.render();
    } catch (error) {
      showNotification('Failed to update guest', 'error');
    }
  },

  async deleteGuest(guestId) {
    try {
      await guestModule.deleteGuest(guestId);
      showNotification('Guest deleted', 'success');
      await this.loadGuests();
      this.render();
    } catch (error) {
      showNotification('Failed to delete guest', 'error');
    }
  },

  openBulkInviteModal() {
    const modal = document.querySelector('[data-modal="bulkInvite"]');
    if (!modal) return;

    modal.style.display = 'flex';

    const submitBtn = modal.querySelector('button[type="submit"]');
    submitBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.submitBulkInvite(modal);
    });
  },

  async submitBulkInvite(modal) {
    const filterStatus = modal.querySelector('[name="filterStatus"]')?.value;

    let guestsToInvite = guestModule.guests;
    if (filterStatus && filterStatus !== 'all') {
      guestsToInvite = guestsToInvite.filter(g => g.rsvpStatus === filterStatus);
    }

    const guestIds = guestsToInvite.map(g => g.id);

    if (guestIds.length === 0) {
      showNotification('No guests to invite', 'error');
      return;
    }

    try {
      await guestModule.sendBulkInvites(guestIds);
      showNotification(`Invites sent to ${guestIds.length} guests`, 'success');
      modal.style.display = 'none';
    } catch (error) {
      showNotification('Failed to send invites', 'error');
    }
  },

  async exportGuests() {
    try {
      await guestModule.exportCSV();
      showNotification('Guests exported to CSV', 'success');
    } catch (error) {
      showNotification('Failed to export guests', 'error');
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.guestListPage = guestListPage;
}
