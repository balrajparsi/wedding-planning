/**
 * Assigned Tasks page rendering and interactions.
 */

const assignedTasksPage = {
  listenersSetup: false,

  async init() {
    if (!this.listenersSetup) {
      this.setupEventListeners();
      this.listenersSetup = true;
    }

    try {
      await assignedTasksModule.fetch();
      this.render();
    } catch (error) {
      showNotification('Failed to load assigned tasks', 'error');
    }
  },

  setupEventListeners() {
    const view = document.querySelector('[data-view="assigned-tasks"]');
    const modal = document.querySelector('[data-modal="addAssignedTask"]');
    const form = modal?.querySelector('form');

    view?.querySelector('.assigned-task-add-btn')?.addEventListener('click', () => {
      form?.reset();
      if (modal) modal.style.display = 'flex';
    });

    modal?.querySelector('.modal-close')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal?.querySelector('.assigned-task-cancel-btn')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal?.addEventListener('click', event => {
      if (event.target === modal) modal.style.display = 'none';
    });

    form?.addEventListener('submit', event => this.submit(event, modal));

    view?.querySelector('.assigned-task-list')?.addEventListener('click', event => {
      const button = event.target.closest('[data-delete-assignment]');
      if (button) this.remove(button.dataset.deleteAssignment);
    });
  },

  escape(value) {
    const element = document.createElement('span');
    element.textContent = String(value || '');
    return element.innerHTML;
  },

  initials(name) {
    return String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('');
  },

  render() {
    const container = document.querySelector('[data-view="assigned-tasks"] .assigned-task-list');
    if (!container) return;

    if (assignedTasksModule.assignments.length === 0) {
      container.innerHTML = '<div class="assigned-task-empty"><p>No responsibilities assigned yet.</p><p>Use “Add Assignment” to add the first one.</p></div>';
      return;
    }

    container.innerHTML = assignedTasksModule.assignments.map(assignment => `
      <article class="assigned-task-card">
        <div class="assigned-task-avatar" aria-hidden="true">${this.escape(this.initials(assignment.name))}</div>
        <div class="assigned-task-details">
          <h3>${this.escape(assignment.name)}</h3>
          <div class="assigned-task-chips">
            ${assignment.tasks.map(task => `<span>${this.escape(task)}</span>`).join('')}
          </div>
        </div>
        <button class="assigned-task-delete" type="button" data-delete-assignment="${this.escape(assignment.id)}" aria-label="Delete assignment for ${this.escape(assignment.name)}" title="Delete assignment">✕</button>
      </article>
    `).join('');
  },

  async submit(event, modal) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('[type="submit"]');
    const data = {
      name: form.elements.name.value.trim(),
      tasks: form.elements.tasks.value.split(',').map(task => task.trim()).filter(Boolean)
    };

    if (!data.name || data.tasks.length === 0) {
      showNotification('Enter a name and at least one task', 'error');
      return;
    }

    try {
      submitButton.disabled = true;
      await assignedTasksModule.add(data);
      this.render();
      modal.style.display = 'none';
      form.reset();
      showNotification('Assignment added', 'success');
    } catch (error) {
      showNotification('Failed to add assignment', 'error');
    } finally {
      submitButton.disabled = false;
    }
  },

  async remove(id) {
    const assignment = assignedTasksModule.assignments.find(item => item.id === id);
    if (!assignment || !window.confirm(`Delete the assignment for ${assignment.name}?`)) return;

    try {
      await assignedTasksModule.remove(id);
      this.render();
      showNotification('Assignment deleted', 'success');
    } catch (error) {
      showNotification('Failed to delete assignment', 'error');
    }
  }
};

if (typeof window !== 'undefined') window.assignedTasksPage = assignedTasksPage;
