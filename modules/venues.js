/**
 * Venue Management Module
 * Client-side logic for venue list (Phase 4)
 */

const venueModule = {
  venues: [],

  async fetch(filters = {}) {
    try {
      const response = await apiCall('/api/venues', 'GET');
      this.venues = response.venues || [];
      return response;
    } catch (error) {
      console.error('Failed to fetch venues:', error);
      throw error;
    }
  }
};

if (typeof window !== 'undefined') {
  window.venueModule = venueModule;
}
