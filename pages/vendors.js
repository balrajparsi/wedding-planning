/**
 * Vendor Manager Page Logic
 * Renders vendor cards, filters, modals
 */

const vendorPage = {
  currentFilters: {
    category: '',
    status: '',
    eventType: '',
    search: ''
  },
  viewMode: 'grid',

  async init() {
    this.setupEventListeners();
    await this.loadVendors();
    this.render();
  },

  setupEventListeners() {
    const vendorView = document.querySelector('[data-view="vendors"]');
    if (!vendorView) return;

    const categoryFilter = vendorView.querySelector('.vendor-category-filter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.currentFilters.category = e.target.value;
        this.applyFilters();
      });
    }

    const statusFilter = vendorView.querySelector('.vendor-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentFilters.status = e.target.value;
        this.applyFilters();
      });
    }

    const addBtn = vendorView.querySelector('.vendor-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddVendorModal());
    }

    const viewToggle = vendorView.querySelector('.vendor-view-toggle');
    if (viewToggle) {
      viewToggle.addEventListener('click', () => {
        this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
        this.render();
      });
    }

    const addVendorModal = document.querySelector('[data-modal="addVendor"]');
    if (addVendorModal) {
      const form = addVendorModal.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitAddVendor(addVendorModal);
        });
      }
    }

    const editVendorModal = document.querySelector('[data-modal="editVendor"]');
    if (editVendorModal) {
      const form = editVendorModal.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitEditVendor(editVendorModal);
        });
      }
    }
  },

  async loadVendors() {
    try {
      await vendorModule.fetch();
    } catch (error) {
      showNotification('Failed to load vendors', 'error');
    }
  },

  applyFilters() {
    vendorModule.filter(this.currentFilters);
    this.render();
  },

  render() {
    const vendorView = document.querySelector('[data-view="vendors"]');
    if (!vendorView) return;
    this.renderStats();
    if (this.viewMode === 'grid') {
      this.renderGrid();
    } else {
      this.renderList();
    }
  },

  renderStats() {
    const vendorView = document.querySelector('[data-view="vendors"]');
    const statsContainer = vendorView?.querySelector('.vendor-stats');
    if (!statsContainer) return;
    const summary = vendorModule.getSummary();
    statsContainer.innerHTML = `
      <div class="stat-card"><div class="stat-value">${summary.total}</div><div class="stat-label">Total Vendors</div></div>
      <div class="stat-card"><div class="stat-value" style="color: #27ae60;">${summary.byStatus.confirmed}</div><div class="stat-label">Confirmed</div></div>
      <div class="stat-card"><div class="stat-value" style="color: #f39c12;">${summary.byStatus.negotiating}</div><div class="stat-label">Negotiating</div></div>
      <div class="stat-card"><div class="stat-value">₹${(summary.totalActual / 100000).toFixed(1)}L</div><div class="stat-label">Amount Paid</div></div>
    `;
  },

  renderGrid() {
    const vendorView = document.querySelector('[data-view="vendors"]');
    const gridContainer = vendorView?.querySelector('.vendor-grid-container');
    if (!gridContainer) return;
    if (vendorModule.filteredVendors.length === 0) {
      gridContainer.innerHTML = '<p class="empty-state">No vendors found.</p>';
      return;
    }
    const grid = document.createElement('div');
    grid.style.cssText = `display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;`;
    vendorModule.filteredVendors.forEach(vendor => {
      grid.appendChild(this.createVendorCard(vendor));
    });
    gridContainer.innerHTML = '';
    gridContainer.appendChild(grid);
  },

  renderList() {
    const vendorView = document.querySelector('[data-view="vendors"]');
    const listContainer = vendorView?.querySelector('.vendor-grid-container');
    if (!listContainer) return;
    if (vendorModule.filteredVendors.length === 0) {
      listContainer.innerHTML = '<p class="empty-state">No vendors found.</p>';
      return;
    }
    const list = document.createElement('div');
    list.style.cssText = `display: flex; flex-direction: column; gap: 1rem;`;
    vendorModule.filteredVendors.forEach(vendor => {
      list.appendChild(this.createVendorCard(vendor));
    });
    listContainer.innerHTML = '';
    listContainer.appendChild(list);
  },

  createVendorCard(vendor) {
    const card = document.createElement('div');
    card.style.cssText = `background: white; padding: 1.5rem; border-radius: 0.75rem; border-left: 4px solid var(--gold); box-shadow: var(--shadow-sm); transition: all 0.2s ease;`;
    const statusColor = { inquiry: '#95a5a6', negotiating: '#f39c12', confirmed: '#3498db', paid: '#27ae60' }[vendor.status] || '#95a5a6';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
        <div><h4 style="color: var(--blue); margin: 0 0 0.25rem 0;">${vendor.name}</h4><p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">${vendor.category}</p></div>
        <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600;">${vendor.status}</span>
      </div>
      ${vendor.contactName ? `<p style="color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0;">👤 ${vendor.contactName}</p>` : ''}
      ${vendor.email ? `<p style="color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0;">📧 ${vendor.email}</p>` : ''}
      ${vendor.phone ? `<p style="color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0;">📱 ${vendor.phone}</p>` : ''}
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #ecf0f1;">
        <div style="font-size: 0.85rem; color: var(--text-muted);">${vendor.documents?.length || 0} doc(s)</div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn-icon edit-vendor" data-id="${vendor.id}" title="Edit">✎</button>
          <button class="btn-icon delete-vendor" data-id="${vendor.id}" title="Delete">✕</button>
        </div>
      </div>
    `;
    card.querySelector('.edit-vendor').addEventListener('click', () => this.openEditVendorModal(vendor));
    card.querySelector('.delete-vendor').addEventListener('click', () => { if (confirm(`Delete "${vendor.name}"?`)) { this.deleteVendor(vendor.id); } });
    card.addEventListener('mouseover', () => { card.style.boxShadow = 'var(--shadow-md)'; card.style.transform = 'translateY(-4px)'; });
    card.addEventListener('mouseout', () => { card.style.boxShadow = 'var(--shadow-sm)'; card.style.transform = 'translateY(0)'; });
    return card;
  },

  openAddVendorModal() {
    const modal = document.querySelector('[data-modal="addVendor"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) form.reset();
      modal.style.display = 'flex';
    }
  },

  async submitAddVendor(modal) {
    const form = modal.querySelector('form');
    const data = {
      name: form.querySelector('[name="name"]')?.value,
      category: form.querySelector('[name="category"]')?.value,
      contactName: form.querySelector('[name="contactName"]')?.value,
      email: form.querySelector('[name="email"]')?.value,
      phone: form.querySelector('[name="phone"]')?.value,
      website: form.querySelector('[name="website"]')?.value,
      eventType: form.querySelector('[name="eventType"]')?.value,
      status: form.querySelector('[name="status"]')?.value || 'inquiry',
      bookedDate: form.querySelector('[name="bookedDate"]')?.value,
      serviceDate: form.querySelector('[name="serviceDate"]')?.value,
      costEstimate: parseFloat(form.querySelector('[name="costEstimate"]')?.value) || 0,
      notes: form.querySelector('[name="notes"]')?.value
    };
    if (!data.name || !data.category) { showNotification('Vendor name and category required', 'error'); return; }
    try {
      await vendorModule.addVendor(data);
      showNotification('Vendor added', 'success');
      modal.style.display = 'none';
      await this.loadVendors();
      this.render();
    } catch (error) {
      showNotification('Failed to add vendor', 'error');
    }
  },

  openEditVendorModal(vendor) {
    const modal = document.querySelector('[data-modal="editVendor"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) {
        form.querySelector('[name="name"]').value = vendor.name;
        form.querySelector('[name="category"]').value = vendor.category;
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
  },

  async submitEditVendor(modal) {
    const vendorId = modal.dataset.vendorId;
    const form = modal.querySelector('form');
    const data = {
      name: form.querySelector('[name="name"]')?.value,
      category: form.querySelector('[name="category"]')?.value,
      contactName: form.querySelector('[name="contactName"]')?.value,
      email: form.querySelector('[name="email"]')?.value,
      phone: form.querySelector('[name="phone"]')?.value,
      website: form.querySelector('[name="website"]')?.value,
      eventType: form.querySelector('[name="eventType"]')?.value,
      status: form.querySelector('[name="status"]')?.value,
      bookedDate: form.querySelector('[name="bookedDate"]')?.value,
      serviceDate: form.querySelector('[name="serviceDate"]')?.value,
      costEstimate: parseFloat(form.querySelector('[name="costEstimate"]')?.value) || 0,
      costActual: parseFloat(form.querySelector('[name="costActual"]')?.value) || 0,
      notes: form.querySelector('[name="notes"]')?.value
    };
    try {
      await vendorModule.updateVendor(vendorId, data);
      showNotification('Vendor updated', 'success');
      modal.style.display = 'none';
      await this.loadVendors();
      this.render();
    } catch (error) {
      showNotification('Failed to update vendor', 'error');
    }
  },

  async deleteVendor(vendorId) {
    try {
      await vendorModule.deleteVendor(vendorId);
      showNotification('Vendor deleted', 'success');
      await this.loadVendors();
      this.render();
    } catch (error) {
      showNotification('Failed to delete vendor', 'error');
    }
  }
};

if (typeof window !== 'undefined') {
  window.vendorPage = vendorPage;
}
