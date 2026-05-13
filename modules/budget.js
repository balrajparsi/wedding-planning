/**
 * Budget Tracking Module — payment-log model, USD
 */

const budgetModule = {
  expenses: [],
  summary: {},

  async fetch() {
    try {
      const res = await apiCall('/api/budget', 'GET');
      this.expenses = res.items || [];
      this.summary  = res.summary || {};
      return res;
    } catch (error) {
      console.error('Failed to fetch budget:', error);
      throw error;
    }
  },

  async addExpense(data) {
    try {
      const response = await apiCall('/api/budget', 'POST', data);
      this.expenses.push(response);
      return response;
    } catch (error) {
      console.error('Failed to add expense:', error);
      throw error;
    }
  },

  async addPayment(expenseId, paymentData) {
    try {
      const response = await apiCall(`/api/budget?id=${expenseId}&action=payment`, 'POST', paymentData);
      const idx = this.expenses.findIndex(e => e.id === expenseId);
      if (idx !== -1) this.expenses[idx] = response;
      return response;
    } catch (error) {
      console.error('Failed to add payment:', error);
      throw error;
    }
  },

  async updateExpense(itemId, updates) {
    try {
      const response = await apiCall(`/api/budget?id=${itemId}`, 'PUT', updates);
      const idx = this.expenses.findIndex(e => e.id === itemId);
      if (idx !== -1) this.expenses[idx] = response;
      return response;
    } catch (error) {
      console.error('Failed to update expense:', error);
      throw error;
    }
  },

  async deleteExpense(itemId) {
    try {
      await apiCall(`/api/budget?id=${itemId}`, 'DELETE');
      this.expenses = this.expenses.filter(e => e.id !== itemId);
      return true;
    } catch (error) {
      console.error('Failed to delete expense:', error);
      throw error;
    }
  },

  async exportCSV() {
    try {
      const response = await fetch('/api/budget?action=export');
      if (!response.ok) throw new Error(`${response.status}`);
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), {
        href: url,
        download: `budget-${new Date().toISOString().split('T')[0]}.csv`
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export budget:', error);
      throw error;
    }
  },

  getSummary() { return this.summary || {}; }
};

if (typeof window !== 'undefined') window.budgetModule = budgetModule;
if (typeof module !== 'undefined' && module.exports) module.exports = budgetModule;
