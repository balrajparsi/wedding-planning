/**
 * Task Management Module
 * Client-side logic for task list (Phase 3)
 */

const taskModule = {
  tasks: [],

  async fetch(filters = {}) {
    try {
      const response = await apiCall('/api/tasks', 'GET');
      this.tasks = response.tasks || [];
      return response;
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      throw error;
    }
  }
};

if (typeof window !== 'undefined') {
  window.taskModule = taskModule;
}
