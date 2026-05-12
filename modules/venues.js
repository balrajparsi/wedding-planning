/**
 * Venues Module - Client-side venue management
 * Handles venue CRUD, filtering, and data manipulation
 */

const venueModule = {
  venues: [],
  filteredVenues: [],

  eventTypes: [
    'Ceremony',
    'Rehearsal Dinner',
    'Pre-Wedding',
    'Sangeet',
    'Mehendi',
    'Reception',
    'Cocktail Hour'
  ],

  amenities: [
    'Indoor AC',
    'Outdoor Space',
    'Catering Kitchen',
    'Parking',
    'WiFi',
    'Sound System',
    'Lighting',
    'Decorations Allowed',
    'Full Bar',
    'Vegetarian Options',
    'Accessibility'
  ],

  async fetch(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (filters.eventType) queryParams.append('eventType', filters.eventType);
      if (filters.status) queryParams.append('status', filters.status);

      const response = await apiCall(`/api/venues?${queryParams.toString()}`, 'GET');
      this.venues = response;
      this.filteredVenues = response;
      return this.venues;
    } catch (error) {
      console.error('Failed to fetch venues:', error);
      throw error;
    }
  },

  filter(filters = {}) {
    this.filteredVenues = this.venues;

    if (filters.eventType) {
      this.filteredVenues = this.filteredVenues.filter(v => v.eventType === filters.eventType);
    }
    if (filters.status) {
      this.filteredVenues = this.filteredVenues.filter(v => v.status === filters.status);
    }
    if (filters.search) {
      const query = filters.search.toLowerCase();
      this.filteredVenues = this.filteredVenues.filter(v =>
        v.name.toLowerCase().includes(query) ||
        v.location.toLowerCase().includes(query)
      );
    }
  },

  async addVenue(data) {
    try {
      const response = await apiCall('/api/venues', 'POST', data);
      this.venues.push(response);
      this.filteredVenues = [...this.venues];
      return response;
    } catch (error) {
      console.error('Failed to add venue:', error);
      throw error;
    }
  },

  async updateVenue(venueId, data) {
    try {
      const response = await apiCall(`/api/venues/${venueId}`, 'PUT', data);
      const index = this.venues.findIndex(v => v.id === venueId);
      if (index !== -1) {
        this.venues[index] = response;
        this.filteredVenues = [...this.venues];
      }
      return response;
    } catch (error) {
      console.error('Failed to update venue:', error);
      throw error;
    }
  },

  async deleteVenue(venueId) {
    try {
      await apiCall(`/api/venues/${venueId}`, 'DELETE');
      this.venues = this.venues.filter(v => v.id !== venueId);
      this.filteredVenues = this.filteredVenues.filter(v => v.id !== venueId);
    } catch (error) {
      console.error('Failed to delete venue:', error);
      throw error;
    }
  },

  async addDocument(venueId, documentName, documentUrl) {
    try {
      const response = await apiCall(`/api/venues/${venueId}/documents`, 'POST', {
        documentName,
        documentUrl
      });
      const index = this.venues.findIndex(v => v.id === venueId);
      if (index !== -1) {
        this.venues[index] = response;
      }
      return response;
    } catch (error) {
      console.error('Failed to add document:', error);
      throw error;
    }
  },

  getSummary() {
    const summary = {
      total: this.venues.length,
      byEventType: {},
      byStatus: {
        inquiry: 0,
        negotiating: 0,
        confirmed: 0,
        paid: 0
      },
      totalEstimate: 0,
      totalActual: 0,
      totalCapacity: 0
    };

    this.venues.forEach(v => {
      // By event type
      if (!summary.byEventType[v.eventType]) {
        summary.byEventType[v.eventType] = 0;
      }
      summary.byEventType[v.eventType]++;

      // By status
      if (summary.byStatus[v.status] !== undefined) {
        summary.byStatus[v.status]++;
      }

      // Costs & capacity
      summary.totalEstimate += v.costEstimate || 0;
      summary.totalActual += v.costActual || 0;
      summary.totalCapacity += v.capacity || 0;
    });

    return summary;
  },

  getVenuesByEventType(eventType) {
    return this.filteredVenues.filter(v => v.eventType === eventType);
  },

  getVenuesByStatus(status) {
    return this.filteredVenues.filter(v => v.status === status);
  },

  getUpcomingVenues() {
    return this.venues
      .filter(v => v.eventDate)
      .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate))
      .slice(0, 5);
  }
};

if (typeof window !== 'undefined') {
  window.venueModule = venueModule;
}
