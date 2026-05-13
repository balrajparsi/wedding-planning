/**
 * Budget Tracker Page Logic — USD, payment-log model
 * Each expense has a totalCost + a log of payments made over time.
 */

const budgetPage = {
  listenersSetup: false,
  currentFilters: { category: '', status: '' },

  async init() {
    if (!this.listenersSetup) {
      this.setupEventListeners();
      this.listenersSetup = true;
    }
    await this.loadBudget();
    this.render();
  },

  setupEventListeners() {
    const view = document.querySelector('[data-view="budget"]');
    if (!view) return;

    view.querySelector('.budget-category-filter')?.addEventListener('change', (e) => {
      this.currentFilters.category = e.target.value;
      this.render();
    });
    view.querySelector('.budget-status-filter')?.addEventListener('change', (e) => {
      this.currentFilters.status = e.target.value;
      this.render();
    });
    view.querySelector('.budget-add-btn')?.addEventListener('click', () => this.openAddExpenseModal());
    view.querySelector('.budget-export-btn')?.addEventListener('click', () => this.exportBudget());
  },

  async loadBudget() {
    try {
      await budgetModule.fetch();
    } catch (error) {
      showNotification('Failed to load budget', 'error');
    }
  },

  render() {
    const view = document.querySelector('[data-view="budget"]');
    if (!view) return;
    this.renderSummary();
    this.renderExpenseList();
  },

  renderSummary() {
    const view = document.querySelector('[data-view="budget"]');
    const container = view?.querySelector('.budget-summary');
    if (!container) return;

    const s = budgetModule.summary;
    const totalCost      = s.totalCost      || 0;
    const totalPaid      = s.totalPaid      || 0;
    const totalRemaining = s.totalRemaining ?? (totalCost - totalPaid);
    const pct = totalCost > 0 ? ((totalPaid / totalCost) * 100).toFixed(1) : 0;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">$${totalCost.toFixed(2)}</div>
        <div class="stat-label">Total Cost</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#27ae60;">$${totalPaid.toFixed(2)}</div>
        <div class="stat-label">Total Paid</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:${totalRemaining >= 0 ? '#f39c12' : '#c0392b'};">$${Math.abs(totalRemaining).toFixed(2)}</div>
        <div class="stat-label">${totalRemaining >= 0 ? 'Remaining' : 'Over Budget'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${pct}%</div>
        <div class="stat-label">Paid</div>
        <div class="progress-bar" style="margin-top:0.5rem;height:6px;">
          <div class="progress-fill" style="width:${Math.min(pct,100)}%;background:${pct > 100 ? '#c0392b' : 'var(--gold)'};height:100%;"></div>
        </div>
      </div>
    `;
  },

  renderExpenseList() {
    const view = document.querySelector('[data-view="budget"]');
    // Use budget-breakdown for category cards + budget-table-container for the expense list
    const breakdownEl = view?.querySelector('.budget-breakdown');
    const tableEl     = view?.querySelector('.budget-table-container');
    if (!tableEl) return;

    let expenses = [...budgetModule.expenses];
    if (this.currentFilters.category) expenses = expenses.filter(e => e.category === this.currentFilters.category);
    if (this.currentFilters.status)   expenses = expenses.filter(e => e.status   === this.currentFilters.status);

    // Category summary cards
    if (breakdownEl) {
      const byCategory = {};
      budgetModule.expenses.forEach(e => {
        if (!byCategory[e.category]) byCategory[e.category] = { totalCost: 0, paid: 0, count: 0 };
        byCategory[e.category].totalCost += parseFloat(e.totalCost) || 0;
        byCategory[e.category].paid      += e.paidAmount || 0;
        byCategory[e.category].count++;
      });

      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;';
      Object.entries(byCategory).forEach(([cat, d]) => {
        const rem   = d.totalCost - d.paid;
        const pct   = d.totalCost > 0 ? ((d.paid / d.totalCost) * 100).toFixed(0) : 0;
        const card  = document.createElement('div');
        card.style.cssText = 'background:white;padding:1rem;border-radius:0.5rem;border-left:4px solid var(--gold);box-shadow:var(--shadow-sm);';
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
            <h5 style="margin:0;color:var(--blue);text-transform:capitalize;">${cat}</h5>
            <span style="font-size:0.75rem;color:#888;">${d.count} item${d.count !== 1 ? 's' : ''}</span>
          </div>
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.4rem;">Paid: <strong>$${d.paid.toFixed(2)}</strong> / $${d.totalCost.toFixed(2)}</div>
          <div class="progress-bar" style="height:5px;margin-bottom:0.4rem;"><div class="progress-fill" style="width:${Math.min(pct,100)}%;background:${pct >= 100 ? '#27ae60' : 'var(--gold)'};height:100%;"></div></div>
          <div style="font-size:0.8rem;color:${rem > 0 ? '#f39c12' : '#27ae60'};">Remaining: $${rem.toFixed(2)}</div>
        `;
        grid.appendChild(card);
      });
      breakdownEl.innerHTML = '';
      breakdownEl.appendChild(grid);
    }

    if (expenses.length === 0) {
      tableEl.innerHTML = '<p class="empty-state">No expenses yet. Add your first expense to get started.</p>';
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;gap:1.5rem;';

    expenses.forEach(expense => {
      const card = document.createElement('div');
      card.style.cssText = 'background:white;border-radius:0.75rem;box-shadow:var(--shadow-sm);overflow:hidden;border-left:4px solid var(--gold);';

      const statusColor = { paid: '#27ae60', partial: '#f39c12', unpaid: '#95a5a6' }[expense.status] || '#95a5a6';
      const pct = expense.totalCost > 0 ? Math.min((expense.paidAmount / expense.totalCost) * 100, 100).toFixed(0) : 0;

      card.innerHTML = `
        <div style="padding:1.25rem;">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.75rem;">
            <div>
              <h4 style="color:var(--blue);margin:0 0 0.25rem 0;">${expense.description}</h4>
              <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                <span style="background:#ecf0f1;padding:0.2rem 0.5rem;border-radius:0.25rem;font-size:0.75rem;text-transform:capitalize;">${expense.category}</span>
                ${expense.vendor ? `<span style="background:#e8f4fd;color:#2a5f7f;padding:0.2rem 0.5rem;border-radius:0.25rem;font-size:0.75rem;">🏢 ${expense.vendor}</span>` : ''}
              </div>
            </div>
            <span style="background:${statusColor};color:white;padding:0.25rem 0.6rem;border-radius:0.25rem;font-size:0.75rem;font-weight:600;text-transform:uppercase;white-space:nowrap;">${expense.status}</span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:0.75rem;">
            <div style="text-align:center;padding:0.5rem;background:#f8f9fa;border-radius:0.4rem;">
              <div style="font-size:1.1rem;font-weight:700;color:var(--blue);">$${(expense.totalCost||0).toFixed(2)}</div>
              <div style="font-size:0.75rem;color:#888;">Total Cost</div>
            </div>
            <div style="text-align:center;padding:0.5rem;background:#f0fdf4;border-radius:0.4rem;">
              <div style="font-size:1.1rem;font-weight:700;color:#27ae60;">$${(expense.paidAmount||0).toFixed(2)}</div>
              <div style="font-size:0.75rem;color:#888;">Paid</div>
            </div>
            <div style="text-align:center;padding:0.5rem;background:${expense.remaining > 0 ? '#fff8f0' : '#f0fdf4'};border-radius:0.4rem;">
              <div style="font-size:1.1rem;font-weight:700;color:${expense.remaining > 0 ? '#f39c12' : '#27ae60'};">$${Math.abs(expense.remaining||0).toFixed(2)}</div>
              <div style="font-size:0.75rem;color:#888;">${expense.remaining > 0 ? 'Remaining' : 'Fully Paid'}</div>
            </div>
          </div>

          <div class="progress-bar" style="height:6px;margin-bottom:1rem;">
            <div class="progress-fill" style="width:${pct}%;background:${pct >= 100 ? '#27ae60' : 'var(--gold)'};height:100%;border-radius:3px;transition:width 0.3s;"></div>
          </div>

          <!-- Payment history -->
          <div class="payment-history" style="margin-bottom:0.75rem;">
            ${(expense.payments||[]).length > 0 ? `
              <div style="font-size:0.8rem;font-weight:600;color:var(--blue);margin-bottom:0.4rem;">Payment History</div>
              ${(expense.payments||[]).map(p => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0.6rem;background:#f8f9fa;border-radius:0.3rem;margin-bottom:0.3rem;font-size:0.82rem;">
                  <span style="color:#555;">${new Date(p.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                  <span style="font-weight:600;color:#27ae60;">+$${(p.amount||0).toFixed(2)}</span>
                  ${p.notes ? `<span style="color:#888;font-style:italic;">${p.notes}</span>` : ''}
                </div>
              `).join('')}
            ` : '<div style="font-size:0.8rem;color:#aaa;">No payments logged yet.</div>'}
          </div>

          <!-- Log new payment -->
          <div class="log-payment-form" style="background:#f8f9fa;border-radius:0.5rem;padding:0.75rem;margin-bottom:0.75rem;">
            <div style="font-size:0.8rem;font-weight:600;color:var(--blue);margin-bottom:0.5rem;">+ Log a Payment</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 2fr auto;gap:0.5rem;align-items:end;">
              <div>
                <label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.2rem;">Amount ($)</label>
                <input type="number" class="pay-amount" placeholder="0.00" step="0.01" min="0" style="width:100%;padding:0.35rem 0.5rem;border:1px solid #ddd;border-radius:0.3rem;font-size:0.85rem;">
              </div>
              <div>
                <label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.2rem;">Date</label>
                <input type="date" class="pay-date" value="${new Date().toISOString().split('T')[0]}" style="width:100%;padding:0.35rem 0.5rem;border:1px solid #ddd;border-radius:0.3rem;font-size:0.85rem;">
              </div>
              <div>
                <label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.2rem;">Notes (optional)</label>
                <input type="text" class="pay-notes" placeholder="e.g. Advance payment" style="width:100%;padding:0.35rem 0.5rem;border:1px solid #ddd;border-radius:0.3rem;font-size:0.85rem;">
              </div>
              <button class="log-payment-btn" style="background:var(--blue);color:white;border:none;padding:0.45rem 0.75rem;border-radius:0.3rem;cursor:pointer;font-size:0.85rem;white-space:nowrap;">Log</button>
            </div>
          </div>

          <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
            <button class="edit-expense-btn" style="background:none;border:1px solid var(--blue);color:var(--blue);padding:0.3rem 0.75rem;border-radius:0.3rem;cursor:pointer;font-size:0.8rem;">✎ Edit</button>
            <button class="delete-expense-btn" style="background:none;border:1px solid #c0392b;color:#c0392b;padding:0.3rem 0.75rem;border-radius:0.3rem;cursor:pointer;font-size:0.8rem;">✕ Delete</button>
          </div>
        </div>
      `;

      // Log payment
      card.querySelector('.log-payment-btn').addEventListener('click', () => {
        const amount = card.querySelector('.pay-amount').value;
        const date   = card.querySelector('.pay-date').value;
        const notes  = card.querySelector('.pay-notes').value;
        this.logPayment(expense.id, { amount, date, notes });
      });

      // Edit
      card.querySelector('.edit-expense-btn').addEventListener('click', () => this.openEditExpenseModal(expense));

      // Delete
      card.querySelector('.delete-expense-btn').addEventListener('click', () => {
        if (confirm(`Delete "${expense.description}"?`)) this.deleteExpense(expense.id);
      });

      wrapper.appendChild(card);
    });

    tableEl.innerHTML = '';
    tableEl.appendChild(wrapper);
  },

  openAddExpenseModal() {
    const modal = document.querySelector('[data-modal="addExpense"]');
    if (!modal) return;
    modal.querySelector('form')?.reset();
    modal.style.display = 'flex';

    const btn = modal.querySelector('button[type="submit"]');
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', (e) => { e.preventDefault(); this.submitAddExpense(modal); });
    }
  },

  async submitAddExpense(modal) {
    const form = modal.querySelector('form');
    const data = {
      description: form.querySelector('[name="description"]')?.value,
      category:    form.querySelector('[name="category"]')?.value,
      totalCost:   parseFloat(form.querySelector('[name="totalCost"]')?.value) || 0,
      vendor:      form.querySelector('[name="vendor"]')?.value,
      notes:       form.querySelector('[name="notes"]')?.value
    };
    if (!data.description || !data.category) { showNotification('Description and category required', 'error'); return; }
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
    if (!modal) return;
    const form = modal.querySelector('form');
    if (form) {
      form.querySelector('[name="description"]').value = expense.description;
      form.querySelector('[name="category"]').value    = expense.category;
      form.querySelector('[name="totalCost"]').value   = (expense.totalCost || 0).toFixed(2);
      form.querySelector('[name="vendor"]').value      = expense.vendor || '';
      form.querySelector('[name="notes"]').value       = expense.notes  || '';
    }
    modal.dataset.expenseId = expense.id;
    modal.style.display = 'flex';

    const btn = modal.querySelector('button[type="submit"]');
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', (e) => { e.preventDefault(); this.submitEditExpense(modal); });
    }
  },

  async submitEditExpense(modal) {
    const expenseId = modal.dataset.expenseId;
    const form      = modal.querySelector('form');
    const data = {
      description: form.querySelector('[name="description"]')?.value,
      category:    form.querySelector('[name="category"]')?.value,
      totalCost:   parseFloat(form.querySelector('[name="totalCost"]')?.value) || 0,
      vendor:      form.querySelector('[name="vendor"]')?.value,
      notes:       form.querySelector('[name="notes"]')?.value
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

  async logPayment(expenseId, paymentData) {
    if (!paymentData.amount || paymentData.amount <= 0) { showNotification('Enter a valid amount', 'error'); return; }
    if (!paymentData.date)  { showNotification('Select a payment date', 'error'); return; }
    try {
      await budgetModule.addPayment(expenseId, paymentData);
      showNotification('Payment logged!', 'success');
      await this.loadBudget();
      this.render();
    } catch (error) {
      showNotification('Failed to log payment', 'error');
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

if (typeof window !== 'undefined') window.budgetPage = budgetPage;
