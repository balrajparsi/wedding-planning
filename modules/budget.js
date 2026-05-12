/**
 * Budget Tracking Module
 * Client-side logic for budget tracker (Phase 3)
 */

const budgetModule = {
  expenses: [],

  async fetch() {
    try {
      const response = await apiCall('/api/budget/items', 'GET');
      this.expenses = response.items || [];
      return response;
    } catch (error) {
      console.error('Failed to fetch budget:', error);
      throw error;
    }
  }
};

if (typeof window !== 'undefined') {
  window.budgetModule = budgetModule;
}
