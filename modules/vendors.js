/**
 * Vendor Management Module
 * Client-side logic for vendor management (Phase 4)
 */

const vendorModule = {
  vendors: [],

  async fetch(filters = {}) {
    try {
      const response = await apiCall('/api/vendors', 'GET');
      this.vendors = response.vendors || [];
      return response;
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      throw error;
    }
  }
};

if (typeof window !== 'undefined') {
  window.vendorModule = vendorModule;
}
