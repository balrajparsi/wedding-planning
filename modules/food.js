/**
 * Food & Menu Module - Client-side food management
 * Handles menu CRUD and dietary accommodations
 */

const foodModule = {
  menuItems: [],
  filteredItems: [],
  rsvpSummary: [],

  eventTypes: [
    'Haldi',
    'Sangeet',
    'Pellikuthuru',
    'Marriage',
    'Satyanarayana Swamy Vratam'
  ],

  courseTypes: [
    'Breakfast',
    'Lunch',
    'Dinner'
  ],

  cuisines: [
    'Indian',
    'Fusion',
    'Continental',
    'Chinese',
    'Italian',
    'Other'
  ],

  async fetch(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (filters.eventType) queryParams.append('eventType', filters.eventType);
      if (filters.courseType) queryParams.append('courseType', filters.courseType);

      const response = await apiCall(`/api/food?${queryParams.toString()}`, 'GET');
      this.menuItems = response;
      this.filteredItems = response;
      return this.menuItems;
    } catch (error) {
      console.error('Failed to fetch menu items:', error);
      throw error;
    }
  },

  async fetchRsvpSummary() {
    try {
      const response = await apiCall('/api/guests?action=rsvp-summary', 'GET');
      this.rsvpSummary = response.events || [];
      return this.rsvpSummary;
    } catch (error) {
      console.error('Failed to fetch RSVP catering summary:', error);
      this.rsvpSummary = [];
      throw error;
    }
  },

  filter(filters = {}) {
    this.filteredItems = this.menuItems;

    if (filters.eventType) {
      this.filteredItems = this.filteredItems.filter(m => m.eventType === filters.eventType);
    }
    if (filters.courseType) {
      this.filteredItems = this.filteredItems.filter(m => m.courseType === filters.courseType);
    }
    if (filters.search) {
      const query = filters.search.toLowerCase();
      this.filteredItems = this.filteredItems.filter(m =>
        m.dish.toLowerCase().includes(query) ||
        m.cuisine.toLowerCase().includes(query)
      );
    }
  },

  async addMenuItem(data) {
    try {
      const response = await apiCall('/api/food', 'POST', data);
      this.menuItems.push(response);
      this.filteredItems = [...this.menuItems];
      return response;
    } catch (error) {
      console.error('Failed to add menu item:', error);
      throw error;
    }
  },

  async importMenuItems(items) {
    try {
      const response = await apiCall('/api/food?action=import', 'POST', { items });
      if (Array.isArray(response.created) && response.created.length) {
        this.menuItems.push(...response.created);
        this.filteredItems = [...this.menuItems];
      }
      return response;
    } catch (error) {
      console.error('Failed to import menu items:', error);
      throw error;
    }
  },

  async updateMenuItem(itemId, data) {
    try {
      const response = await apiCall(`/api/food?id=${itemId}`, 'PUT', data);
      const index = this.menuItems.findIndex(m => m.id === itemId);
      if (index !== -1) {
        this.menuItems[index] = response;
        this.filteredItems = [...this.menuItems];
      }
      return response;
    } catch (error) {
      console.error('Failed to update menu item:', error);
      throw error;
    }
  },

  async deleteMenuItem(itemId) {
    try {
      await apiCall(`/api/food?id=${itemId}`, 'DELETE');
      this.menuItems = this.menuItems.filter(m => m.id !== itemId);
      this.filteredItems = this.filteredItems.filter(m => m.id !== itemId);
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      throw error;
    }
  },

  async resetMenuItems() {
    try {
      await apiCall('/api/food?action=reset', 'DELETE');
      this.menuItems = [];
      this.filteredItems = [];
    } catch (error) {
      console.error('Failed to reset menu items:', error);
      throw error;
    }
  },

  async addGuestAccommodation(itemId, guestId, modification) {
    try {
      const response = await apiCall(`/api/food/${itemId}/accommodation`, 'POST', {
        guestId,
        modification
      });
      const index = this.menuItems.findIndex(m => m.id === itemId);
      if (index !== -1) {
        this.menuItems[index] = response;
      }
      return response;
    } catch (error) {
      console.error('Failed to add accommodation:', error);
      throw error;
    }
  },

  getSummary() {
    const summary = {
      total: this.menuItems.length,
      byEventType: {},
      byCourseType: {},
      byVegType: {
        veg: 0,
        'non-veg': 0,
        both: 0
      },
      totalCost: 0
    };

    this.menuItems.forEach(m => {
      // By event type
      if (!summary.byEventType[m.eventType]) {
        summary.byEventType[m.eventType] = 0;
      }
      summary.byEventType[m.eventType]++;

      // By meal type
      if (!summary.byCourseType[m.courseType]) {
        summary.byCourseType[m.courseType] = 0;
      }
      summary.byCourseType[m.courseType]++;

      // By veg type
      if (summary.byVegType[m.vegNonVeg] !== undefined) {
        summary.byVegType[m.vegNonVeg]++;
      }

      // Total cost
      summary.totalCost += m.cost || 0;
    });

    return summary;
  },

  getItemsByEventType(eventType) {
    return this.filteredItems.filter(m => m.eventType === eventType);
  },

  getItemsByCourseType(courseType) {
    return this.filteredItems.filter(m => m.courseType === courseType);
  }
};

if (typeof window !== 'undefined') {
  window.foodModule = foodModule;
}
