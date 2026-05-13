/**
 * Budget Tracking Module
 */

const budgetModule = {
  expenses: [],
  summary: {},

  async fetch() {
    try {
      const [itemsRes, summary] = await Promise.all([
        apiCall('/api/budget?action=items', 'GET'),
        apiCall('/api/budget?action=summary', 'GET')
      ]);
      this.expenses = itemsRes.items || itemsRes || [];
      this.summary  = summary || {};
      return { items: this.expenses, summary: this.summary };
    } catch (error) {
      console.error('Failed to fetch budget:', error);
      throw error;
    }
  },

  async addExpense(data) {
    try {
      const response = await apiCall('/api/budget?action=items', 'POST', data);
      this.expenses.push(response);
      return response;
    } catch (error) {
      console.error('Failed to add expense:', error);
      throw error;
    }
  },

  async updateExpense(itemId, updates) {
    try {
      const response = await apiCall(`/api/budget?action=items&id=${itemId}`, 'PUT', updates);
      const index = this.expenses.findIndex(e => e.id === itemId);
      if (index !== -1) this.expenses[index] = response;
      return response;
    } catch (error) {
      console.error('Failed to update expense:', error);
      throw error;
    }
  },

  async deleteExpense(itemId) {
    try {
      await apiCall(`/api/budget?action=items&id=${itemId}`, 'DELETE');
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

  getSummary() { return this.summary || {}; },
  getByCategory(cat) { return this.expenses.filter(e => e.category === cat); }
};

if (typeof window !== 'undefined') window.budgetModule = budgetModule;
if (typeof module !== 'undefined' && module.exports) module.exports = budgetModule;
