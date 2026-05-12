/**
 * Budget Tracker Page Logic
 * Renders budget overview, category breakdown, and expense list
 */

const budgetPage = {
  currentFilters: {
    category: '',
    status: ''
  },

  async init() {
    this.setupEventListeners();
    await this.loadBudget();
    this.render();
  },

  setupEventListeners() {
    const budgetView = document.querySelector('[data-view="budget"]');
    if (!budgetView) return;

    // Category filter
    const categoryFilter = budgetView.querySelector('.budget-category-filter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.currentFilters.category = e.target.value;
        this.applyFilters();
      });
    }

    // Status filter
    const statusFilter = budgetView.querySelector('.budget-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentFilters.status = e.target.value;
        this.applyFilters();
      });
    }

    // Add expense button
    const addBtn = budgetView.querySelector('.budget-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddExpenseModal());
    }

    // Export button
    const exportBtn = budgetView.querySelector('.budget-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportBudget());
    }

    // Modal form submissions
    const addExpenseModal = document.querySelector('[data-modal="addExpense"]');
    if (addExpenseModal) {
      const form = addExpenseModal.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitAddExpense(addExpenseModal);
        });
      }
    }

    const editExpenseModal = document.querySelector('[data-modal="editExpense"]');
    if (editExpenseModal) {
      const form = editExpenseModal.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitEditExpense(editExpenseModal);
        });
      }
    }
  },

  async loadBudget() {
    try {
      await budgetModule.fetch();
    } catch (error) {
      showNotification('Failed to load budget', 'error');
    }
  },

  applyFilters() {
    this.render();
  },

  render() {
    const budgetView = document.querySelector('[data-view="budget"]');
    if (!budgetView) return;

    this.renderSummary();
    this.renderCategoryBreakdown();
    this.renderExpenseTable();
  },

  renderSummary() {
    const budgetView = document.querySelector('[data-view="budget"]');
    const summaryContainer = budgetView?.querySelector('.budget-summary');
    if (!summaryContainer) return;

    const summary = budgetModule.getSummary();
    const remaining = (summary.totalBudgeted || 0) - (summary.totalActual || 0);
    const percentSpent = summary.totalBudgeted ? ((summary.totalActual / summary.totalBudgeted) * 100).toFixed(1) : 0;

    summaryContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">₹${(summary.totalBudgeted / 100000).toFixed(1)}L</div>
        <div class="stat-label">Total Budgeted</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #f39c12;">₹${(summary.totalActual / 100000).toFixed(1)}L</div>
        <div class="stat-label">Amount Spent</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: ${remaining >= 0 ? '#27ae60' : '#c0392b'};">₹${(remaining / 100000).toFixed(1)}L</div>
        <div class="stat-label">${remaining >= 0 ? 'Remaining' : 'Over Budget'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${percentSpent}%</div>
        <div class="stat-label">Budget Used</div>
        <div class="progress-bar" style="margin-top: 0.5rem; height: 6px;">
          <div class="progress-fill" style="width: ${percentSpent}%; background: ${percentSpent > 100 ? '#c0392b' : 'var(--gold)'}; height: 100%;"></div>
        </div>
      </div>
    `;
  },

  renderCategoryBreakdown() {
    const budgetView = document.querySelector('[data-view="budget"]');
    const breakdownContainer = budgetView?.querySelector('.budget-breakdown');
    if (!breakdownContainer) return;

    const summary = budgetModule.getSummary();
    const categories = summary.byCategory || {};

    const breakdown = document.createElement('div');
    breakdown.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
    `;

    Object.entries(categories).forEach(([cat, data]) => {
      if (data.budgeted === 0) return; // Skip empty categories

      const card = document.createElement('div');
      card.className = 'category-card';
      card.style.cssText = `
        background: white;
        padding: 1rem;
        border-radius: 0.5rem;
        border-left: 4px solid var(--gold);
        box-shadow: var(--shadow-sm);
      `;

      const percentUsed = data.budgeted ? ((data.actual / data.budgeted) * 100).toFixed(0) : 0;
      const statusColor = data.status === 'paid' ? '#27ae60' : data.status === 'partial' ? '#f39c12' : '#95a5a6';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h5 style="color: var(--blue); margin: 0; text-transform: capitalize;">${cat}</h5>
          <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600;">
            ${data.status.toUpperCase()}
          </span>
        </div>
        <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem;">
          ₹${(data.actual / 100000).toFixed(1)}L / ₹${(data.budgeted / 100000).toFixed(1)}L
        </div>
        <div class="progress-bar" style="height: 6px; margin-bottom: 0.5rem;">
          <div class="progress-fill" style="width: ${Math.min(percentUsed, 100)}%; background: ${percentUsed > 100 ? '#c0392b' : 'var(--gold)'}; height: 100%;"></div>
        </div>
        <div style="font-size: 0.85rem; color: ${percentUsed > 100 ? '#c0392b' : 'var(--text-muted)'}; font-weight: ${percentUsed > 100 ? '600' : '400'};">
          ${percentUsed}% ${percentUsed > 100 ? '(OVER)' : 'used'}
        </div>
      `;

      breakdown.appendChild(card);
    });

    breakdownContainer.innerHTML = '';
    breakdownContainer.appendChild(breakdown);
  },

  renderExpenseTable() {
    const budgetView = document.querySelector('[data-view="budget"]');
    const tableContainer = budgetView?.querySelector('.budget-table-container');
    if (!tableContainer) return;

    let filtered = budgetModule.expenses;

    if (this.currentFilters.category && this.currentFilters.category !== 'all') {
      filtered = filtered.filter(e => e.category === this.currentFilters.category);
    }

    if (this.currentFilters.status && this.currentFilters.status !== 'all') {
      filtered = filtered.filter(e => e.status === this.currentFilters.status);
    }

    if (filtered.length === 0) {
      tableContainer.innerHTML = '<p class="empty-state">No expenses found.</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'budget-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Description</th>
        <th>Category</th>
        <th>Budgeted</th>
        <th>Actual</th>
        <th>Status</th>
        <th>Vendor</th>
        <th>Actions</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    filtered.forEach(expense => {
      const tr = document.createElement('tr');
      const statusColor = {
        paid: '#27ae60',
        partial: '#f39c12',
        pending: '#95a5a6'
      }[expense.status] || '#95a5a6';

      tr.innerHTML = `
        <td><strong>${expense.description}</strong></td>
        <td><span style="text-transform: capitalize;">${expense.category}</span></td>
        <td>₹${(expense.budgeted / 100000).toFixed(2)}L</td>
        <td style="font-weight: 600;">₹${(expense.actual / 100000).toFixed(2)}L</td>
        <td>
          <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">
            ${expense.status}
          </span>
        </td>
        <td>${expense.vendor || '-'}</td>
        <td>
          <button class="btn-icon edit-expense" data-id="${expense.id}" title="Edit">✎</button>
          <button class="btn-icon delete-expense" data-id="${expense.id}" title="Delete">✕</button>
        </td>
      `;

      tr.querySelector('.edit-expense').addEventListener('click', () => {
        this.openEditExpenseModal(expense);
      });

      tr.querySelector('.delete-expense').addEventListener('click', () => {
        if (confirm(`Delete "${expense.description}"?`)) {
          this.deleteExpense(expense.id);
        }
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    tableContainer.innerHTML = '';
    tableContainer.appendChild(table);
  },

  openAddExpenseModal() {
    const modal = document.querySelector('[data-modal="addExpense"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) form.reset();
      modal.style.display = 'flex';
    }
  },

  async submitAddExpense(modal) {
    const form = modal.querySelector('form');
    const data = {
      description: form.querySelector('[name="description"]')?.value,
      category: form.querySelector('[name="category"]')?.value,
      budgeted: parseFloat(form.querySelector('[name="budgeted"]')?.value) * 100000 || 0,
      actual: parseFloat(form.querySelector('[name="actual"]')?.value) * 100000 || 0,
      status: form.querySelector('[name="status"]')?.value,
      vendor: form.querySelector('[name="vendor"]')?.value,
      dueDate: form.querySelector('[name="dueDate"]')?.value,
      notes: form.querySelector('[name="notes"]')?.value
    };

    if (!data.description || !data.category) {
      showNotification('Description and category required', 'error');
      return;
    }

    try {
      await budgetModule.addExpense(data);
      showNotification('Expense added', 'success');
      modal.style.display = 'none';
      await this.loadBudget();
      this.render();
    } catch (error) {
      showNotification('Failed to add expense', 'error');
    }
  },

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
  },

  async submitEditExpense(modal) {
    const expenseId = modal.dataset.expenseId;
    const form = modal.querySelector('form');
    const data = {
      description: form.querySelector('[name="description"]')?.value,
      category: form.querySelector('[name="category"]')?.value,
      budgeted: parseFloat(form.querySelector('[name="budgeted"]')?.value) * 100000 || 0,
      actual: parseFloat(form.querySelector('[name="actual"]')?.value) * 100000 || 0,
      status: form.querySelector('[name="status"]')?.value,
      vendor: form.querySelector('[name="vendor"]')?.value,
      dueDate: form.querySelector('[name="dueDate"]')?.value,
      notes: form.querySelector('[name="notes"]')?.value
    };

    try {
      await budgetModule.updateExpense(expenseId, data);
      showNotification('Expense updated', 'success');
      modal.style.display = 'none';
      await this.loadBudget();
      this.render();
    } catch (error) {
      showNotification('Failed to update expense', 'error');
    }
  },

  async deleteExpense(expenseId) {
    try {
      await budgetModule.deleteExpense(expenseId);
      showNotification('Expense deleted', 'success');
      await this.loadBudget();
      this.render();
    } catch (error) {
      showNotification('Failed to delete expense', 'error');
    }
  },

  async exportBudget() {
    try {
      await budgetModule.exportCSV();
      showNotification('Budget exported to CSV', 'success');
    } catch (error) {
      showNotification('Failed to export budget', 'error');
    }
  }
};

if (typeof window !== 'undefined') {
  window.budgetPage = budgetPage;
}
