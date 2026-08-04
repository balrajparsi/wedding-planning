/**
 * Assigned Tasks client-side data module.
 */

const assignedTasksModule = {
  assignments: [],

  async fetch() {
    this.assignments = await apiCall('/api/assigned-tasks', 'GET');
    return this.assignments;
  },

  async add(data) {
    const assignment = await apiCall('/api/assigned-tasks', 'POST', data);
    this.assignments.push(assignment);
    return assignment;
  },

  async remove(id) {
    await apiCall(`/api/assigned-tasks?id=${encodeURIComponent(id)}`, 'DELETE');
    this.assignments = this.assignments.filter(assignment => assignment.id !== id);
  }
};

if (typeof window !== 'undefined') window.assignedTasksModule = assignedTasksModule;
