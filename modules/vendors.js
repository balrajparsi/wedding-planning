/**
 * Vendor Module - Client-side vendor management
 * Handles vendor CRUD, filtering, and data manipulation
 */

const vendorModule = {
  vendors: [],
  filteredVendors: [],

  categories: [
    'Photography',
    'Catering',
    'Florist',
    'Music/DJ',
    'Decor',
    'Venue',
    'Transportation',
    'Makeup/Hair',
    'Invitations',
    'Rings/Jewelry',
    'Honeymoon',
    'Other'
  ],

  eventTypes: [
    'Ceremony',
    'Rehearsal Dinner',
    'Pre-Wedding',
    'Sangeet',
    'Mehendi',
    'Reception',
    'Multiple Events'
  ],

  async fetch(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.eventType) queryParams.append('eventType', filters.eventType);

      const response = await apiCall(`/api/vendors?${queryParams.toString()}`, 'GET');
      this.vendors = response;
      this.filteredVendors = response;
      return this.vendors;
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      throw error;
    }
  },

  filter(filters = {}) {
    this.filteredVendors = this.vendors;

    if (filters.category) {
      this.filteredVendors = this.filteredVendors.filter(v => v.category === filters.category);
    }
    if (filters.status) {
      this.filteredVendors = this.filteredVendors.filter(v => v.status === filters.status);
    }
    if (filters.eventType) {
      this.filteredVendors = this.filteredVendors.filter(v => v.eventType === filters.eventType);
    }
    if (filters.search) {
      const query = filters.search.toLowerCase();
      this.filteredVendors = this.filteredVendors.filter(v =>
        v.name.toLowerCase().includes(query) ||
        v.contactName.toLowerCase().includes(query) ||
        v.email.toLowerCase().includes(query)
      );
    }
  },

  async addVendor(data) {
    try {
      const response = await apiCall('/api/vendors', 'POST', data);
      this.vendors.push(response);
      this.filteredVendors = [...this.vendors];
      return response;
    } catch (error) {
      console.error('Failed to add vendor:', error);
      throw error;
    }
  },

  async updateVendor(vendorId, data) {
    try {
      const response = await apiCall(`/api/vendors?id=${vendorId}`, 'PUT', data);
      const index = this.vendors.findIndex(v => v.id === vendorId);
      if (index !== -1) {
        this.vendors[index] = response;
        this.filteredVendors = [...this.vendors];
      }
      return response;
    } catch (error) {
      console.error('Failed to update vendor:', error);
      throw error;
    }
  },

  async deleteVendor(vendorId) {
    try {
      await apiCall(`/api/vendors?id=${vendorId}`, 'DELETE');
      this.vendors = this.vendors.filter(v => v.id !== vendorId);
      this.filteredVendors = this.filteredVendors.filter(v => v.id !== vendorId);
    } catch (error) {
      console.error('Failed to delete vendor:', error);
      throw error;
    }
  },

  async addDocument(vendorId, documentName, documentUrl) {
    try {
      const response = await apiCall(`/api/vendors?id=${vendorId}&action=documents`, 'POST', {
        documentName,
        documentUrl
      });
      const index = this.vendors.findIndex(v => v.id === vendorId);
      if (index !== -1) {
        this.vendors[index] = response;
      }
      return response;
    } catch (error) {
      console.error('Failed to add document:', error);
      throw error;
    }
  },

  async removeDocument(vendorId, docIndex) {
    try {
      const response = await apiCall(`/api/vendors?id=${vendorId}&action=documents&docIndex=${docIndex}`, 'DELETE');
      const index = this.vendors.findIndex(v => v.id === vendorId);
      if (index !== -1) {
        this.vendors[index] = response;
      }
      return response;
    } catch (error) {
      console.error('Failed to remove document:', error);
      throw error;
    }
  },

  getSummary() {
    const summary = {
      total: this.vendors.length,
      byCategory: {},
      byStatus: {
        inquiry: 0,
        negotiating: 0,
        confirmed: 0,
        paid: 0
      },
      totalEstimate: 0,
      totalActual: 0
    };

    this.vendors.forEach(v => {
      // By category
      if (!summary.byCategory[v.category]) {
        summary.byCategory[v.category] = 0;
      }
      summary.byCategory[v.category]++;

      // By status
      if (summary.byStatus[v.status] !== undefined) {
        summary.byStatus[v.status]++;
      }

      // Costs
      summary.totalEstimate += v.costEstimate || 0;
      summary.totalActual += v.costActual || 0;
    });

    return summary;
  },

  getVendorsByCategory(category) {
    return this.filteredVendors.filter(v => v.category === category);
  },

  getVendorsByStatus(status) {
    return this.filteredVendors.filter(v => v.status === status);
  },

  getUpcomingServiceDates() {
    return this.vendors
      .filter(v => v.serviceDate)
      .sort((a, b) => new Date(a.serviceDate) - new Date(b.serviceDate))
      .slice(0, 5);
  }
};

if (typeof window !== 'undefined') {
  window.vendorModule = vendorModule;
}
