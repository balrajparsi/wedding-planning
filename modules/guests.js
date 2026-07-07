/**
 * Guest Management Module
 * Client-side logic for guest list, RSVP tracking, and filtering
 */

const guestModule = {
  // State
  guests: [],
  filteredGuests: [],
  stats: {},

  // Get all guests with filters
  async fetch(filters = {}) {
    try {
      const params = new URLSearchParams({
        rsvpStatus: filters.rsvpStatus || '',
        search: filters.search || '',
        sortBy: filters.sortBy || 'name',
        sortDir: filters.sortDir || 'asc'
      });

      // Remove empty params
      for (let [key, value] of params.entries()) {
        if (!value) params.delete(key);
      }

      const response = await apiCall(`/api/guests?${params.toString()}`, 'GET');
      this.guests = response.guests || [];
      this.stats = response.stats || {};
      this.filteredGuests = this.guests;
      return response;
    } catch (error) {
      console.error('Failed to fetch guests:', error);
      throw error;
    }
  },

  // Add new guest
  async addGuest(guestData) {
    try {
      const response = await apiCall('/api/guests', 'POST', guestData);
      this.guests.push(response);
      return response;
    } catch (error) {
      console.error('Failed to add guest:', error);
      throw error;
    }
  },

  // Update guest or RSVP status
  async updateGuest(guestId, updates) {
    try {
      const response = await apiCall(`/api/guests?id=${guestId}`, 'PUT', updates);
      const index = this.guests.findIndex(g => g.id === guestId);
      if (index !== -1) {
        this.guests[index] = response;
      }
      return response;
    } catch (error) {
      console.error('Failed to update guest:', error);
      throw error;
    }
  },

  // Delete guest
  async deleteGuest(guestId) {
    try {
      await apiCall(`/api/guests?id=${guestId}`, 'DELETE');
      this.guests = this.guests.filter(g => g.id !== guestId);
      return true;
    } catch (error) {
      console.error('Failed to delete guest:', error);
      throw error;
    }
  },

  // Send bulk reminders
  async sendBulkReminders(payload = {}) {
    try {
      const response = await apiCall('/api/guests?action=bulk-reminder', 'POST', payload);
      return response;
    } catch (error) {
      console.error('Failed to send reminders:', error);
      throw error;
    }
  },

  // Send bulk invites
  async sendBulkInvites(payload = {}) {
    // payload: { guestIds?, filterStatus?, subject?, message? }
    try {
      const response = await apiCall('/api/guests?action=bulk-invite', 'POST', payload);
      return response;
    } catch (error) {
      console.error('Failed to send invites:', error);
      throw error;
    }
  },

  // Export guests as CSV
  async exportCSV() {
    try {
      const response = await fetch('/api/guests?action=export', {
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error(`Export failed: ${response.status}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `guests-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error('Failed to export guests:', error);
      throw error;
    }
  },

  // Filter guests locally
  filter(filters = {}) {
    let filtered = [...this.guests];

    if (filters.rsvpStatus && filters.rsvpStatus !== 'all') {
      filtered = filtered.filter(g => g.rsvpStatus === filters.rsvpStatus);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(g =>
        g.name.toLowerCase().includes(search) ||
        g.email?.toLowerCase().includes(search) ||
        g.phone?.includes(search) ||
        (Array.isArray(g.events) ? g.events.join(' ') : String(g.events || '')).toLowerCase().includes(search)
      );
    }

    // Sort
    const sortBy = filters.sortBy || 'name';
    const sortDir = filters.sortDir || 'asc';

    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortBy === 'partySize') {
        aVal = parseInt(aVal) || 1;
        bVal = parseInt(bVal) || 1;
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    this.filteredGuests = filtered;
    return filtered;
  },

  // Get summary stats
  getSummary() {
    return {
      total: this.guests.length,
      accepted: this.guests.filter(g => g.rsvpStatus === 'accepted').length,
      declined: this.guests.filter(g => g.rsvpStatus === 'declined').length,
      pending: this.guests.filter(g => g.rsvpStatus === 'pending').length,
      maybe: this.guests.filter(g => g.rsvpStatus === 'maybe').length,
      totalPartySize: this.guests.reduce((sum, g) => sum + (parseInt(g.partySize) || 1), 0)
    };
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.guestModule = guestModule;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = guestModule;
}
