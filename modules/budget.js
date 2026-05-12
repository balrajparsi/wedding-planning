/**
 * Budget Tracking Module
 * Client-side logic for budget tracker
 */

const budgetModule = {
  expenses: [],
  summary: {},

  async fetch() {
    try {
      const [items, summary] = await Promise.all([
        apiCall('/api/budget/items', 'GET'),
        apiCall('/api/budget/summary', 'GET')
      ]);
      this.expenses = items.items || [];
      this.summary = summary;
      return { items, summary };
    } catch (error) {
      console.error('Failed to fetch budget:', error);
      throw error;
    }
  },

  async addExpense(data) {
    try {
      const response = await apiCall('/api/budget/items', 'POST', data);
      this.expenses.push(response);
      return response;
    } catch (error) {
      console.error('Failed to add expense:', error);
      throw error;
    }
  },

  async updateExpense(itemId, updates) {
    try {
      const response = await apiCall(`/api/budget/items/${itemId}`, 'PUT', updates);
      const index = this.expenses.findIndex(e => e.id === itemId);
      if (index !== -1) {
        this.expenses[index] = response;
      }
      return response;
    } catch (error) {
      console.error('Failed to update expense:', error);
      throw error;
    }
  },

  async deleteExpense(itemId) {
    try {
      await apiCall(`/api/budget/items/${itemId}`, 'DELETE');
      this.expenses = this.expenses.filter(e => e.id !== itemId);
      return true;
    } catch (error) {
      console.error('Failed to delete expense:', error);
      throw error;
    }
  },

  async exportCSV() {
    try {
      const response = await fetch(apiCall('/api/budget/export', 'GET'));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `budget-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error('Failed to export budget:', error);
      throw error;
    }
  },

  getSummary() {
    return this.summary || {};
  },

  getByCategory(category) {
    return this.expenses.filter(e => e.category === category);
  }
};

if (typeof window !== 'undefined') {
  window.budgetModule = budgetModule;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = budgetModule;
}
