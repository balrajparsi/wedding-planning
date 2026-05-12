/**
 * Guest List Page Logic
 */

const guestListPage = {
  listenersSetup: false, // prevents stacking listeners on repeated navigation

  currentFilters: {
    rsvpStatus: '',
    search: '',
    dietary: '',
    sortBy: 'name',
    sortDir: 'asc'
  },

  async init() {
    // Only wire up listeners once — fixes 7× CSV download bug
    if (!this.listenersSetup) {
      this.setupEventListeners();
      this.listenersSetup = true;
    }
    await this.loadGuests();
    this.render();
  },

  setupEventListeners() {
    const view = document.querySelector('[data-view="guests"]');
    if (!view) return;

    // Search
    view.querySelector('.guest-search')?.addEventListener('input', (e) => {
      this.currentFilters.search = e.target.value;
      this.applyFilters();
    });

    // RSVP filter
    view.querySelector('.guest-rsvp-filter')?.addEventListener('change', (e) => {
      this.currentFilters.rsvpStatus = e.target.value;
      this.applyFilters();
    });

    // Dietary filter
    view.querySelector('.guest-dietary-filter')?.addEventListener('change', (e) => {
      this.currentFilters.dietary = e.target.value;
      this.applyFilters();
    });

    // Clear filters
    view.querySelector('.guest-clear-btn')?.addEventListener('click', () => {
      this.currentFilters = { rsvpStatus: '', search: '', dietary: '', sortBy: 'name', sortDir: 'asc' };
      view.querySelector('.guest-search').value = '';
      view.querySelector('.guest-rsvp-filter').value = '';
      view.querySelector('.guest-dietary-filter').value = '';
      guestModule.filteredGuests = [...guestModule.guests];
      this.render();
    });

    // Add guest
    view.querySelector('.guest-add-btn')?.addEventListener('click', () => this.openAddGuestModal());

    // Export CSV
    view.querySelector('.guest-export-btn')?.addEventListener('click', () => this.exportGuests());

    // Bulk invite
    view.querySelector('.guest-bulk-invite-btn')?.addEventListener('click', () => this.openBulkInviteModal());

    // Reset all (testing)
    view.querySelector('.guest-reset-btn')?.addEventListener('click', () => this.resetAllGuests());
  },

  async loadGuests() {
    try {
      const response = await apiCall('/api/guests', 'GET');
      guestModule.guests = response.guests || [];
      guestModule.stats  = response.stats  || {};
      // Always sync filteredGuests after a fresh fetch
      guestModule.filteredGuests = [...guestModule.guests];
    } catch (error) {
      showNotification('Failed to load guests', 'error');
      guestModule.guests = [];
      guestModule.filteredGuests = [];
    }
  },

  applyFilters() {
    guestModule.filter(this.currentFilters);
    this.render();
  },

  render() {
    this.renderStats();
    this.renderTable();
  },

  renderStats() {
    const view = document.querySelector('[data-view="guests"]');
    const container = view?.querySelector('.guest-stats');
    if (!container) return;

    const g = guestModule.guests;
    const total       = g.length;
    const accepted    = g.filter(x => x.rsvpStatus === 'accepted').length;
    const pending     = g.filter(x => x.rsvpStatus === 'pending').length;
    const declined    = g.filter(x => x.rsvpStatus === 'declined').length;
    const partySize   = g.reduce((s, x) => s + (parseInt(x.partySize) || 1), 0);

    container.innerHTML = `
      <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total Guests</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#27ae60">${accepted}</div><div class="stat-label">Accepted</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#f39c12">${pending}</div><div class="stat-label">Pending</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#c0392b">${declined}</div><div class="stat-label">Declined</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#2a5f7f">${partySize}</div><div class="stat-label">Total Party Size</div></div>
    `;
  },

  renderTable() {
    const view = document.querySelector('[data-view="guests"]');
    const container = view?.querySelector('.guest-table-container');
    if (!container) return;

    const guests = guestModule.filteredGuests;

    if (!guests || guests.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:3rem;color:var(--text-muted);">
          <div style="font-size:3rem;margin-bottom:1rem;">👥</div>
          <p style="font-size:1rem;">No guests found. Add your first guest to get started.</p>
        </div>`;
      return;
    }

    const tbody = guests.map(g => `
      <tr>
        <td><strong>${g.name || '—'}</strong></td>
        <td>${g.email || '—'}</td>
        <td>${g.phone || '—'}</td>
        <td>${g.relationship || '—'}</td>
        <td style="text-align:center">${g.partySize || 1}</td>
        <td>${g.dietaryRestrictions || 'None'}</td>
        <td><span class="badge badge-${g.rsvpStatus}">${g.rsvpStatus}</span></td>
        <td>
          <button class="btn-icon" onclick="guestListPage.openEditGuestModal(${JSON.stringify(g).replace(/"/g, '&quot;')})" title="Edit">✎</button>
          <button class="btn-icon" style="color:#c0392b" onclick="guestListPage.deleteGuest('${g.id}')" title="Delete">✕</button>
        </td>
      </tr>`).join('');

    container.innerHTML = `
      <table class="guest-table" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="cursor:pointer" onclick="guestListPage.sortBy('name')">Name ↕</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Relationship</th>
            <th>Party Size</th>
            <th>Dietary</th>
            <th style="cursor:pointer" onclick="guestListPage.sortBy('rsvpStatus')">RSVP ↕</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>`;
  },

  sortBy(field) {
    if (this.currentFilters.sortBy === field) {
      this.currentFilters.sortDir = this.currentFilters.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentFilters.sortBy = field;
      this.currentFilters.sortDir = 'asc';
    }
    this.applyFilters();
  },

  /* ── MODALS ── */
  openAddGuestModal() {
    const modal = document.querySelector('[data-modal="addGuest"]');
    if (!modal) return;
    modal.querySelector('form')?.reset();
    modal.style.display = 'flex';

    // Use { once: true } so listener doesn't stack
    const btn = modal.querySelector('button[type="submit"]');
    if (btn) {
      const newBtn = btn.cloneNode(true); // removes all old listeners
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.submitAddGuest(modal);
      });
    }
  },

  async submitAddGuest(modal) {
    const form = modal.querySelector('form');
    const data = {
      name:                 form.querySelector('[name="name"]')?.value?.trim(),
      email:                form.querySelector('[name="email"]')?.value?.trim(),
      phone:                form.querySelector('[name="phone"]')?.value?.trim(),
      relationship:         form.querySelector('[name="relationship"]')?.value?.trim(),
      partySize:            parseInt(form.querySelector('[name="partySize"]')?.value) || 1,
      dietaryRestrictions:  form.querySelector('[name="dietary"]')?.value,
      notes:                form.querySelector('[name="notes"]')?.value?.trim()
    };

    if (!data.name) { showNotification('Guest name is required', 'error'); return; }

    try {
      await apiCall('/api/guests', 'POST', data);
      showNotification('Guest added!', 'success');
      modal.style.display = 'none';
      await this.loadGuests();
      this.render();
    } catch (err) {
      showNotification('Failed to add guest', 'error');
    }
  },

  openEditGuestModal(guest) {
    const modal = document.querySelector('[data-modal="editGuest"]');
    if (!modal) return;

    const form = modal.querySelector('form');
    if (form) {
      form.querySelector('[name="name"]').value        = guest.name || '';
      form.querySelector('[name="email"]').value       = guest.email || '';
      form.querySelector('[name="phone"]').value       = guest.phone || '';
      form.querySelector('[name="relationship"]').value= guest.relationship || '';
      form.querySelector('[name="partySize"]').value   = guest.partySize || 1;
      form.querySelector('[name="dietary"]').value     = guest.dietaryRestrictions || 'none';
      form.querySelector('[name="rsvpStatus"]').value  = guest.rsvpStatus || 'pending';
      form.querySelector('[name="notes"]').value       = guest.notes || '';
    }

    modal.style.display = 'flex';
    modal.dataset.guestId = guest.id;

    const btn = modal.querySelector('button[type="submit"]');
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.submitEditGuest(modal);
      });
    }
  },

  async submitEditGuest(modal) {
    const guestId = modal.dataset.guestId;
    const form = modal.querySelector('form');
    const data = {
      name:                form.querySelector('[name="name"]')?.value?.trim(),
      email:               form.querySelector('[name="email"]')?.value?.trim(),
      phone:               form.querySelector('[name="phone"]')?.value?.trim(),
      relationship:        form.querySelector('[name="relationship"]')?.value?.trim(),
      partySize:           parseInt(form.querySelector('[name="partySize"]')?.value) || 1,
      dietaryRestrictions: form.querySelector('[name="dietary"]')?.value,
      rsvpStatus:          form.querySelector('[name="rsvpStatus"]')?.value,
      notes:               form.querySelector('[name="notes"]')?.value?.trim()
    };

    try {
      await apiCall(`/api/guests/${guestId}`, 'PUT', data);
      showNotification('Guest updated!', 'success');
      modal.style.display = 'none';
      await this.loadGuests();
      this.render();
    } catch (err) {
      showNotification('Failed to update guest', 'error');
    }
  },

  async deleteGuest(guestId) {
    if (!confirm('Delete this guest?')) return;
    try {
      await apiCall(`/api/guests/${guestId}`, 'DELETE');
      showNotification('Guest deleted', 'success');
      await this.loadGuests();
      this.render();
    } catch (err) {
      showNotification('Failed to delete guest', 'error');
    }
  },

  async resetAllGuests() {
    if (!confirm('⚠️ Reset ALL guests? This will permanently delete all guest data.')) return;
    try {
      await apiCall('/api/guests/reset', 'DELETE');
      guestModule.guests = [];
      guestModule.filteredGuests = [];
      showNotification('All guests cleared', 'success');
      this.render();
    } catch (err) {
      showNotification('Failed to reset guests', 'error');
    }
  },

  openBulkInviteModal() {
    const modal = document.querySelector('[data-modal="bulkInvite"]');
    if (modal) modal.style.display = 'flex';
  },

  async exportGuests() {
    try {
      const response = await fetch('/api/guests?action=export');
      if (!response.ok) throw new Error(`${response.status}`);
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), {
        href: url,
        download: `guests-${new Date().toISOString().split('T')[0]}.csv`
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      showNotification('Failed to export guests', 'error');
    }
  }
};

if (typeof window !== 'undefined') window.guestListPage = guestListPage;
