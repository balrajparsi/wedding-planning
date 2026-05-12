/**
 * Food & Menu Planning Module
 * Client-side logic for food menu planning (Phase 4)
 */

const foodModule = {
  menuItems: [],

  async fetch() {
    try {
      const response = await apiCall('/api/food', 'GET');
      this.menuItems = response.items || [];
      return response;
    } catch (error) {
      console.error('Failed to fetch menu:', error);
      throw error;
    }
  }
};

if (typeof window !== 'undefined') {
  window.foodModule = foodModule;
}
