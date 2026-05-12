/**
 * Venues Page Logic
 * Renders venue cards for different event types
 */

const venuesPage = {
  currentFilters: {
    eventType: '',
    status: '',
    search: ''
  },
  viewMode: 'grid',

  async init() {
    this.setupEventListeners();
    await this.loadVenues();
    this.render();
  },

  setupEventListeners() {
    const venueView = document.querySelector('[data-view="venues"]');
    if (!venueView) return;

    const eventTypeFilter = venueView.querySelector('.venue-event-type-filter');
    if (eventTypeFilter) {
      eventTypeFilter.addEventListener('change', (e) => {
        this.currentFilters.eventType = e.target.value;
        this.applyFilters();
      });
    }

    const statusFilter = venueView.querySelector('.venue-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentFilters.status = e.target.value;
        this.applyFilters();
      });
    }

    const addBtn = venueView.querySelector('.venue-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddVenueModal());
    }

    const addVenueModal = document.querySelector('[data-modal="addVenue"]');
    if (addVenueModal) {
      const form = addVenueModal.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitAddVenue(addVenueModal);
        });
      }
    }

    const editVenueModal = document.querySelector('[data-modal="editVenue"]');
    if (editVenueModal) {
      const form = editVenueModal.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitEditVenue(editVenueModal);
        });
      }
    }
  },

  async loadVenues() {
    try {
      await venueModule.fetch();
    } catch (error) {
      showNotification('Failed to load venues', 'error');
    }
  },

  applyFilters() {
    venueModule.filter(this.currentFilters);
    this.render();
  },

  render() {
    const venueView = document.querySelector('[data-view="venues"]');
    if (!venueView) return;
    this.renderStats();
    this.renderGrid();
  },

  renderStats() {
    const venueView = document.querySelector('[data-view="venues"]');
    const statsContainer = venueView?.querySelector('.venue-stats');
    if (!statsContainer) return;

    const summary = venueModule.getSummary();
    statsContainer.innerHTML = `
      <div class="stat-card"><div class="stat-value">${summary.total}</div><div class="stat-label">Total Venues</div></div>
      <div class="stat-card"><div class="stat-value" style="color: #27ae60;">${summary.byStatus.confirmed}</div><div class="stat-label">Confirmed</div></div>
      <div class="stat-card"><div class="stat-value">₹${(summary.totalActual / 100000).toFixed(1)}L</div><div class="stat-label">Amount Paid</div></div>
      <div class="stat-card"><div class="stat-value">${summary.totalCapacity}</div><div class="stat-label">Total Capacity</div></div>
    `;
  },

  renderGrid() {
    const venueView = document.querySelector('[data-view="venues"]');
    const gridContainer = venueView?.querySelector('.venue-grid-container');
    if (!gridContainer) return;

    if (venueModule.filteredVenues.length === 0) {
      gridContainer.innerHTML = '<p class="empty-state">No venues found.</p>';
      return;
    }

    const grid = document.createElement('div');
    grid.style.cssText = `display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;`;

    venueModule.filteredVenues.forEach(venue => {
      grid.appendChild(this.createVenueCard(venue));
    });

    gridContainer.innerHTML = '';
    gridContainer.appendChild(grid);
  },

  createVenueCard(venue) {
    const card = document.createElement('div');
    card.style.cssText = `background: white; padding: 1.5rem; border-radius: 0.75rem; border-left: 4px solid var(--gold); box-shadow: var(--shadow-sm); transition: all 0.2s ease;`;

    const statusColor = { inquiry: '#95a5a6', negotiating: '#f39c12', confirmed: '#3498db', paid: '#27ae60' }[venue.status] || '#95a5a6';
    const eventTypeIcon = { 'Ceremony': '👰', 'Rehearsal Dinner': '🍽️', 'Pre-Wedding': '💐', 'Sangeet': '🎵', 'Mehendi': '🎨', 'Reception': '🎉', 'Cocktail Hour': '🍸' };
    const icon = eventTypeIcon[venue.eventType] || '📍';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
        <div><h4 style="color: var(--blue); margin: 0 0 0.25rem 0;">${icon} ${venue.name}</h4><p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">${venue.eventType}</p></div>
        <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600;">${venue.status}</span>
      </div>
      ${venue.location ? `<p style="color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0;">📍 ${venue.location}</p>` : ''}
      ${venue.capacity ? `<p style="color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0;">👥 Capacity: ${venue.capacity}</p>` : ''}
      ${venue.eventDate ? `<p style="color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0;">📅 ${new Date(venue.eventDate).toLocaleDateString()}</p>` : ''}
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #ecf0f1;">
        <div style="font-size: 0.85rem; color: var(--text-muted);">₹${(venue.costActual / 100000).toFixed(1)}L paid</div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn-icon edit-venue" data-id="${venue.id}" title="Edit">✎</button>
          <button class="btn-icon delete-venue" data-id="${venue.id}" title="Delete">✕</button>
        </div>
      </div>
    `;

    card.querySelector('.edit-venue').addEventListener('click', () => this.openEditVenueModal(venue));
    card.querySelector('.delete-venue').addEventListener('click', () => { if (confirm(`Delete "${venue.name}"?`)) { this.deleteVenue(venue.id); } });
    card.addEventListener('mouseover', () => { card.style.boxShadow = 'var(--shadow-md)'; card.style.transform = 'translateY(-4px)'; });
    card.addEventListener('mouseout', () => { card.style.boxShadow = 'var(--shadow-sm)'; card.style.transform = 'translateY(0)'; });

    return card;
  },

  openAddVenueModal() {
    const modal = document.querySelector('[data-modal="addVenue"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) form.reset();
      modal.style.display = 'flex';
    }
  },

  async submitAddVenue(modal) {
    const form = modal.querySelector('form');
    const data = {
      name: form.querySelector('[name="name"]')?.value,
      eventType: form.querySelector('[name="eventType"]')?.value,
      location: form.querySelector('[name="location"]')?.value,
      address: form.querySelector('[name="address"]')?.value,
      phone: form.querySelector('[name="phone"]')?.value,
      contactPerson: form.querySelector('[name="contactPerson"]')?.value,
      email: form.querySelector('[name="email"]')?.value,
      capacity: parseInt(form.querySelector('[name="capacity"]')?.value) || 0,
      costEstimate: parseFloat(form.querySelector('[name="costEstimate"]')?.value) || 0,
      status: form.querySelector('[name="status"]')?.value || 'inquiry',
      eventDate: form.querySelector('[name="eventDate"]')?.value,
      notes: form.querySelector('[name="notes"]')?.value
    };

    if (!data.name || !data.eventType) { showNotification('Venue name and event type required', 'error'); return; }

    try {
      await venueModule.addVenue(data);
      showNotification('Venue added', 'success');
      modal.style.display = 'none';
      await this.loadVenues();
      this.render();
    } catch (error) {
      showNotification('Failed to add venue', 'error');
    }
  },

  openEditVenueModal(venue) {
    const modal = document.querySelector('[data-modal="editVenue"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) {
        form.querySelector('[name="name"]').value = venue.name;
        form.querySelector('[name="eventType"]').value = venue.eventType || '';
        form.querySelector('[name="location"]').value = venue.location || '';
        form.querySelector('[name="address"]').value = venue.address || '';
        form.querySelector('[name="phone"]').value = venue.phone || '';
        form.querySelector('[name="contactPerson"]').value = venue.contactPerson || '';
        form.querySelector('[name="email"]').value = venue.email || '';
        form.querySelector('[name="capacity"]').value = venue.capacity || '';
        form.querySelector('[name="costEstimate"]').value = venue.costEstimate || '';
        form.querySelector('[name="costActual"]').value = venue.costActual || '';
        form.querySelector('[name="status"]').value = venue.status;
        form.querySelector('[name="eventDate"]').value = venue.eventDate || '';
        form.querySelector('[name="notes"]').value = venue.notes || '';
      }
      modal.dataset.venueId = venue.id;
      modal.style.display = 'flex';
    }
  },

  async submitEditVenue(modal) {
    const venueId = modal.dataset.venueId;
    const form = modal.querySelector('form');
    const data = {
      name: form.querySelector('[name="name"]')?.value,
      eventType: form.querySelector('[name="eventType"]')?.value,
      location: form.querySelector('[name="location"]')?.value,
      address: form.querySelector('[name="address"]')?.value,
      phone: form.querySelector('[name="phone"]')?.value,
      contactPerson: form.querySelector('[name="contactPerson"]')?.value,
      email: form.querySelector('[name="email"]')?.value,
      capacity: parseInt(form.querySelector('[name="capacity"]')?.value) || 0,
      costEstimate: parseFloat(form.querySelector('[name="costEstimate"]')?.value) || 0,
      costActual: parseFloat(form.querySelector('[name="costActual"]')?.value) || 0,
      status: form.querySelector('[name="status"]')?.value,
      eventDate: form.querySelector('[name="eventDate"]')?.value,
      notes: form.querySelector('[name="notes"]')?.value
    };

    try {
      await venueModule.updateVenue(venueId, data);
      showNotification('Venue updated', 'success');
      modal.style.display = 'none';
      await this.loadVenues();
      this.render();
    } catch (error) {
      showNotification('Failed to update venue', 'error');
    }
  },

  async deleteVenue(venueId) {
    try {
      await venueModule.deleteVenue(venueId);
      showNotification('Venue deleted', 'success');
      await this.loadVenues();
      this.render();
    } catch (error) {
      showNotification('Failed to delete venue', 'error');
    }
  }
};

if (typeof window !== 'undefined') {
  window.venuesPage = venuesPage;
}
