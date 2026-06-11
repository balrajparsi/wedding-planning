/**
 * Task Management Module
 * Client-side logic for task list
 */

const taskModule = {
  tasks: [],
  filteredTasks: [],
  stats: {},

  async fetch(filters = {}) {
    try {
      const params = new URLSearchParams({
        category: filters.category || '',
        status: filters.status || '',
        assignee: filters.assignee || '',
        sortBy: filters.sortBy || 'dueDate'
      });

      for (let [key, value] of params.entries()) {
        if (!value) params.delete(key);
      }

      const response = await apiCall(`/api/tasks?${params.toString()}`, 'GET');
      this.tasks = response.tasks || [];
      this.stats = response.stats || {};
      this.filteredTasks = this.tasks;
      return response;
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      throw error;
    }
  },

  async addTask(taskData) {
    try {
      const response = await apiCall('/api/tasks', 'POST', taskData);
      this.tasks.push(response);
      return response;
    } catch (error) {
      console.error('Failed to add task:', error);
      throw error;
    }
  },

  async updateTask(taskId, updates) {
    try {
      const response = await apiCall(`/api/tasks?id=${taskId}`, 'PUT', updates);
      const index = this.tasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        this.tasks[index] = response;
      }
      return response;
    } catch (error) {
      console.error('Failed to update task:', error);
      throw error;
    }
  },

  async deleteTask(taskId) {
    try {
      await apiCall(`/api/tasks?id=${taskId}`, 'DELETE');
      this.tasks = this.tasks.filter(t => t.id !== taskId);
      return true;
    } catch (error) {
      console.error('Failed to delete task:', error);
      throw error;
    }
  },

  async addSubtask(taskId, title) {
    try {
      const response = await apiCall(`/api/tasks?id=${taskId}&action=subtasks`, 'POST', { title });
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        task.subtasks.push(response);
      }
      return response;
    } catch (error) {
      console.error('Failed to add subtask:', error);
      throw error;
    }
  },

  async updateSubtask(taskId, subtaskId, updates) {
    try {
      const response = await apiCall(`/api/tasks?id=${taskId}&action=subtask&subId=${subtaskId}`, 'PUT', updates);
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        const subtask = task.subtasks.find(s => s.id === subtaskId);
        if (subtask) Object.assign(subtask, response);
      }
      return response;
    } catch (error) {
      console.error('Failed to update subtask:', error);
      throw error;
    }
  },

  filter(filters = {}) {
    let filtered = [...this.tasks];

    if (filters.category && filters.category !== 'all') {
      filtered = filtered.filter(t => t.category === filters.category);
    }

    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    if (filters.assignee && filters.assignee !== 'all') {
      filtered = filtered.filter(t => t.assignees?.includes(filters.assignee));
    }

    this.filteredTasks = filtered;
    return filtered;
  },

  getSummary() {
    return {
      total: this.tasks.length,
      pending: this.tasks.filter(t => t.status === 'pending').length,
      inProgress: this.tasks.filter(t => t.status === 'in-progress').length,
      completed: this.tasks.filter(t => t.status === 'completed').length,
      overdue: this.tasks.filter(t => t.status !== 'completed' && parseCentralDate(t.dueDate) < new Date()).length
    };
  },

  getTasksByStatus(status) {
    return this.tasks.filter(t => t.status === status);
  }
};

if (typeof window !== 'undefined') {
  window.taskModule = taskModule;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = taskModule;
}
