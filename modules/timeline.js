/**
 * Timeline Module - Client-side timeline/milestone management
 * Handles milestones, deadlines, and event scheduling
 */

const timelineModule = {
  milestones: [],
  filteredMilestones: [],

  types: [
    'Event',
    'Deadline',
    'Reminder',
    'Milestone'
  ],

  eventTypes: [
    'Sangeet',
    'Pellikuthuru',
    'Marriage',
    'Satyanarayana Swamy Vratam'
  ],

  async fetch(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (filters.type) queryParams.append('type', filters.type);

      const response = await apiCall(`/api/timeline?${queryParams.toString()}`, 'GET');
      this.milestones = response;
      this.filteredMilestones = response;
      return this.milestones;
    } catch (error) {
      console.error('Failed to fetch milestones:', error);
      throw error;
    }
  },

  filter(filters = {}) {
    this.filteredMilestones = this.milestones;

    if (filters.type) {
      this.filteredMilestones = this.filteredMilestones.filter(m => m.type === filters.type);
    }
    if (filters.search) {
      const query = filters.search.toLowerCase();
      this.filteredMilestones = this.filteredMilestones.filter(m =>
        m.title.toLowerCase().includes(query) ||
        m.location.toLowerCase().includes(query)
      );
    }
  },

  async addMilestone(data) {
    try {
      const response = await apiCall('/api/timeline', 'POST', data);
      this.milestones.push(response);
      this.filteredMilestones = [...this.milestones];
      return response;
    } catch (error) {
      console.error('Failed to add milestone:', error);
      throw error;
    }
  },

  async updateMilestone(milestoneId, data) {
    try {
      const response = await apiCall(`/api/timeline?id=${milestoneId}`, 'PUT', data);
      const index = this.milestones.findIndex(m => m.id === milestoneId);
      if (index !== -1) {
        this.milestones[index] = response;
        this.filteredMilestones = [...this.milestones];
      }
      return response;
    } catch (error) {
      console.error('Failed to update milestone:', error);
      throw error;
    }
  },

  async deleteMilestone(milestoneId) {
    try {
      await apiCall(`/api/timeline?id=${milestoneId}`, 'DELETE');
      this.milestones = this.milestones.filter(m => m.id !== milestoneId);
      this.filteredMilestones = this.filteredMilestones.filter(m => m.id !== milestoneId);
    } catch (error) {
      console.error('Failed to delete milestone:', error);
      throw error;
    }
  },

  getSummary() {
    const summary = {
      total: this.milestones.length,
      byType: {
        event: 0,
        deadline: 0,
        reminder: 0,
        milestone: 0
      },
      upcoming: 0,
      pastDue: 0
    };

    const now = new Date();

    this.milestones.forEach(m => {
      // By type
      if (summary.byType[m.type.toLowerCase()] !== undefined) {
        summary.byType[m.type.toLowerCase()]++;
      }

      // Upcoming vs Past
      const mDate = parseCentralDate(m.date);
      if (mDate > now) {
        summary.upcoming++;
      } else if (m.type === 'deadline') {
        summary.pastDue++;
      }
    });

    return summary;
  },

  getMilestonesByType(type) {
    return this.filteredMilestones.filter(m => m.type === type);
  },

  getUpcomingMilestones(days = 30) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return this.milestones
      .filter(m => {
        const mDate = parseCentralDate(m.date);
        return mDate >= now && mDate <= futureDate;
      })
      .sort((a, b) => parseCentralDate(a.date) - parseCentralDate(b.date));
  },

  getEventsByMonth(year, month) {
    return this.milestones.filter(m => {
      const mDate = parseCentralDate(m.date);
      return mDate.getFullYear() === year && mDate.getMonth() === month;
    });
  }
};

if (typeof window !== 'undefined') {
  window.timelineModule = timelineModule;
}
