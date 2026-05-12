/**
 * Food & Menu Page Logic
 * Renders menu items by event and course type
 */

const foodPage = {
  currentFilters: {
    eventType: '',
    courseType: '',
    search: ''
  },

  async init() {
    this.setupEventListeners();
    await this.loadFood();
    this.render();
  },

  setupEventListeners() {
    const foodView = document.querySelector('[data-view="food"]');
    if (!foodView) return;

    const eventTypeFilter = foodView.querySelector('.food-event-type-filter');
    if (eventTypeFilter) {
      eventTypeFilter.addEventListener('change', (e) => {
        this.currentFilters.eventType = e.target.value;
        this.applyFilters();
      });
    }

    const courseTypeFilter = foodView.querySelector('.food-course-type-filter');
    if (courseTypeFilter) {
      courseTypeFilter.addEventListener('change', (e) => {
        this.currentFilters.courseType = e.target.value;
        this.applyFilters();
      });
    }

    const addBtn = foodView.querySelector('.food-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddDishModal());
    }

    const addDishModal = document.querySelector('[data-modal="addDish"]');
    if (addDishModal) {
      const form = addDishModal.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitAddDish(addDishModal);
        });
      }
    }

    const editDishModal = document.querySelector('[data-modal="editDish"]');
    if (editDishModal) {
      const form = editDishModal.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitEditDish(editDishModal);
        });
      }
    }
  },

  async loadFood() {
    try {
      await foodModule.fetch();
    } catch (error) {
      showNotification('Failed to load menu', 'error');
    }
  },

  applyFilters() {
    foodModule.filter(this.currentFilters);
    this.render();
  },

  render() {
    const foodView = document.querySelector('[data-view="food"]');
    if (!foodView) return;
    this.renderStats();
    this.renderMenuItems();
  },

  renderStats() {
    const foodView = document.querySelector('[data-view="food"]');
    const statsContainer = foodView?.querySelector('.food-stats');
    if (!statsContainer) return;

    const summary = foodModule.getSummary();
    statsContainer.innerHTML = `
      <div class="stat-card"><div class="stat-value">${summary.total}</div><div class="stat-label">Menu Items</div></div>
      <div class="stat-card"><div class="stat-value">${summary.byVegType.veg}</div><div class="stat-label">Vegetarian</div></div>
      <div class="stat-card"><div class="stat-value">${summary.byVegType['non-veg']}</div><div class="stat-label">Non-Vegetarian</div></div>
      <div class="stat-card"><div class="stat-value">₹${(summary.totalCost / 100000).toFixed(1)}L</div><div class="stat-label">Total Cost</div></div>
    `;
  },

  renderMenuItems() {
    const foodView = document.querySelector('[data-view="food"]');
    const menuContainer = foodView?.querySelector('.food-list-container');
    if (!menuContainer) return;

    if (foodModule.filteredItems.length === 0) {
      menuContainer.innerHTML = '<p class="empty-state">No menu items found.</p>';
      return;
    }

    const list = document.createElement('div');
    list.style.cssText = `display: flex; flex-direction: column; gap: 1rem;`;

    foodModule.filteredItems.forEach(item => {
      const card = document.createElement('div');
      card.style.cssText = `background: white; padding: 1rem; border-radius: 0.5rem; border-left: 3px solid var(--gold); box-shadow: var(--shadow-sm);`;

      const vegIcon = item.vegNonVeg === 'veg' ? '🥬' : item.vegNonVeg === 'non-veg' ? '🍖' : '🍽️';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <h5 style="color: var(--blue); margin: 0; display: flex; gap: 0.5rem; align-items: center;">
              ${vegIcon} ${item.dish}
              <span style="background: var(--gold); color: white; padding: 0.2rem 0.4rem; border-radius: 0.2rem; font-size: 0.7rem;">${item.courseType}</span>
            </h5>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0.25rem 0;">
              ${item.eventType} • ${item.cuisine} • ₹${(item.cost / 100000).toFixed(2)}L • ${item.portionSize}
            </p>
            ${item.guestAccommodations?.length ? `<p style="color: var(--text-muted); font-size: 0.8rem; margin: 0.25rem 0;">👥 ${item.guestAccommodations.length} guest accommodation(s)</p>` : ''}
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-icon edit-dish" data-id="${item.id}" title="Edit">✎</button>
            <button class="btn-icon delete-dish" data-id="${item.id}" title="Delete">✕</button>
          </div>
        </div>
      `;

      card.querySelector('.edit-dish').addEventListener('click', () => this.openEditDishModal(item));
      card.querySelector('.delete-dish').addEventListener('click', () => { if (confirm(`Delete "${item.dish}"?`)) { this.deleteDish(item.id); } });

      list.appendChild(card);
    });

    menuContainer.innerHTML = '';
    menuContainer.appendChild(list);
  },

  openAddDishModal() {
    const modal = document.querySelector('[data-modal="addDish"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) form.reset();
      modal.style.display = 'flex';
    }
  },

  async submitAddDish(modal) {
    const form = modal.querySelector('form');
    const data = {
      eventType: form.querySelector('[name="eventType"]')?.value,
      courseType: form.querySelector('[name="courseType"]')?.value,
      dish: form.querySelector('[name="dish"]')?.value,
      vegNonVeg: form.querySelector('[name="vegNonVeg"]')?.value || 'both',
      cost: parseFloat(form.querySelector('[name="cost"]')?.value) || 0,
      portionSize: form.querySelector('[name="portionSize"]')?.value || '1 plate',
      preparedBy: form.querySelector('[name="preparedBy"]')?.value,
      cuisine: form.querySelector('[name="cuisine"]')?.value,
      notes: form.querySelector('[name="notes"]')?.value
    };

    if (!data.dish || !data.eventType || !data.courseType) { showNotification('Dish, event, and course type required', 'error'); return; }

    try {
      await foodModule.addMenuItem(data);
      showNotification('Dish added', 'success');
      modal.style.display = 'none';
      await this.loadFood();
      this.render();
    } catch (error) {
      showNotification('Failed to add dish', 'error');
    }
  },

  openEditDishModal(item) {
    const modal = document.querySelector('[data-modal="editDish"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) {
        form.querySelector('[name="dish"]').value = item.dish;
        form.querySelector('[name="eventType"]').value = item.eventType;
        form.querySelector('[name="courseType"]').value = item.courseType;
        form.querySelector('[name="vegNonVeg"]').value = item.vegNonVeg;
        form.querySelector('[name="cost"]').value = item.cost || '';
        form.querySelector('[name="portionSize"]').value = item.portionSize || '';
        form.querySelector('[name="preparedBy"]').value = item.preparedBy || '';
        form.querySelector('[name="cuisine"]').value = item.cuisine || '';
        form.querySelector('[name="notes"]').value = item.notes || '';
      }
      modal.dataset.dishId = item.id;
      modal.style.display = 'flex';
    }
  },

  async submitEditDish(modal) {
    const dishId = modal.dataset.dishId;
    const form = modal.querySelector('form');
    const data = {
      dish: form.querySelector('[name="dish"]')?.value,
      eventType: form.querySelector('[name="eventType"]')?.value,
      courseType: form.querySelector('[name="courseType"]')?.value,
      vegNonVeg: form.querySelector('[name="vegNonVeg"]')?.value,
      cost: parseFloat(form.querySelector('[name="cost"]')?.value) || 0,
      portionSize: form.querySelector('[name="portionSize"]')?.value,
      preparedBy: form.querySelector('[name="preparedBy"]')?.value,
      cuisine: form.querySelector('[name="cuisine"]')?.value,
      notes: form.querySelector('[name="notes"]')?.value
    };

    try {
      await foodModule.updateMenuItem(dishId, data);
      showNotification('Dish updated', 'success');
      modal.style.display = 'none';
      await this.loadFood();
      this.render();
    } catch (error) {
      showNotification('Failed to update dish', 'error');
    }
  },

  async deleteDish(dishId) {
    try {
      await foodModule.deleteMenuItem(dishId);
      showNotification('Dish deleted', 'success');
      await this.loadFood();
      this.render();
    } catch (error) {
      showNotification('Failed to delete dish', 'error');
    }
  }
};

if (typeof window !== 'undefined') {
  window.foodPage = foodPage;
}
