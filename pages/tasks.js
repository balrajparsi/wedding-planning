/**
 * Task Board Page Logic
 * Renders task board with Kanban columns or list view
 */

const taskListPage = {
  currentFilters: {
    category: '',
    status: '',
    assignee: '',
    sortBy: 'dueDate'
  },
  viewMode: 'kanban', // 'kanban' or 'list'

  async init() {
    this.setupEventListeners();
    await this.loadTasks();
    this.render();
  },

  setupEventListeners() {
    const taskView = document.querySelector('[data-view="tasks"]');
    if (!taskView) return;

    // Category filter
    const categoryFilter = taskView.querySelector('.task-category-filter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.currentFilters.category = e.target.value;
        this.applyFilters();
      });
    }

    // Status filter
    const statusFilter = taskView.querySelector('.task-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentFilters.status = e.target.value;
        this.applyFilters();
      });
    }

    // Add task button
    const addBtn = taskView.querySelector('.task-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddTaskModal());
    }

    // View mode toggle
    const viewToggle = taskView.querySelector('.task-view-toggle');
    if (viewToggle) {
      viewToggle.addEventListener('click', () => {
        this.viewMode = this.viewMode === 'kanban' ? 'list' : 'kanban';
        this.render();
      });
    }

    // Modal form submissions
    const addTaskModal = document.querySelector('[data-modal="addTask"]');
    if (addTaskModal) {
      const form = addTaskModal.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitAddTask(addTaskModal);
        });
      }
    }

    const editTaskModal = document.querySelector('[data-modal="editTask"]');
    if (editTaskModal) {
      const form = editTaskModal.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitEditTask(editTaskModal);
        });
      }
    }
  },

  async loadTasks() {
    try {
      await taskModule.fetch(this.currentFilters);
    } catch (error) {
      showNotification('Failed to load tasks', 'error');
    }
  },

  applyFilters() {
    taskModule.filter(this.currentFilters);
    this.render();
  },

  render() {
    const taskView = document.querySelector('[data-view="tasks"]');
    if (!taskView) return;

    this.renderStats();

    if (this.viewMode === 'kanban') {
      this.renderKanban();
    } else {
      this.renderList();
    }
  },

  renderStats() {
    const taskView = document.querySelector('[data-view="tasks"]');
    const statsContainer = taskView?.querySelector('.task-stats');
    if (!statsContainer) return;

    const stats = taskModule.getSummary();

    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">Total Tasks</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #f39c12;">${stats.pending}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #3498db;">${stats.inProgress}</div>
        <div class="stat-label">In Progress</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #27ae60;">${stats.completed}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #c0392b;">${stats.overdue}</div>
        <div class="stat-label">Overdue</div>
      </div>
    `;
  },

  renderKanban() {
    const taskView = document.querySelector('[data-view="tasks"]');
    const boardContainer = taskView?.querySelector('.task-board-container');
    if (!boardContainer) return;

    const statuses = ['pending', 'in-progress', 'completed'];
    const statusLabels = { pending: 'To Do', 'in-progress': 'In Progress', completed: 'Completed' };
    const statusColors = { pending: '#f39c12', 'in-progress': '#3498db', completed: '#27ae60' };

    const board = document.createElement('div');
    board.className = 'kanban-board';
    board.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
      min-height: 500px;
    `;

    statuses.forEach(status => {
      const tasks = taskModule.getTasksByStatus(status);
      const column = document.createElement('div');
      column.className = 'kanban-column';
      column.style.cssText = `
        background: var(--cream);
        border-radius: 0.75rem;
        padding: 1.5rem;
        border-left: 4px solid ${statusColors[status]};
      `;

      const header = document.createElement('div');
      header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      `;
      header.innerHTML = `
        <h4 style="color: var(--blue);">${statusLabels[status]}</h4>
        <span style="background: ${statusColors[status]}; color: white; padding: 0.25rem 0.75rem; border-radius: 0.5rem; font-size: 0.85rem; font-weight: 600;">${tasks.length}</span>
      `;
      column.appendChild(header);

      const tasksList = document.createElement('div');
      tasksList.className = 'tasks-list';
      tasksList.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 1rem;
      `;

      tasks.forEach(task => {
        const taskCard = this.createTaskCard(task);
        tasksList.appendChild(taskCard);
      });

      column.appendChild(tasksList);
      board.appendChild(column);
    });

    boardContainer.innerHTML = '';
    boardContainer.appendChild(board);
  },

  renderList() {
    const taskView = document.querySelector('[data-view="tasks"]');
    const listContainer = taskView?.querySelector('.task-board-container');
    if (!listContainer) return;

    if (taskModule.filteredTasks.length === 0) {
      listContainer.innerHTML = '<p class="empty-state">No tasks found. Create your first task to get started.</p>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'tasks-list-view';
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 1rem;
    `;

    taskModule.filteredTasks.forEach(task => {
      list.appendChild(this.createTaskCard(task));
    });

    listContainer.innerHTML = '';
    listContainer.appendChild(list);
  },

  createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.style.cssText = `
      background: white;
      padding: 1rem;
      border-radius: 0.5rem;
      border-left: 3px solid var(--gold);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    const priorityColor = {
      high: '#c0392b',
      medium: '#f39c12',
      low: '#27ae60'
    }[task.priority] || '#95a5a6';

    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const isOverdue = dueDate && dueDate < new Date() && task.status !== 'completed';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
        <h4 style="color: var(--blue); margin: 0; flex: 1;">${task.title}</h4>
        <span style="background: ${priorityColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; white-space: nowrap;">
          ${task.priority.toUpperCase()}
        </span>
      </div>
      <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0.5rem 0; min-height: 1.2rem;">
        ${task.category ? `<span style="display: inline-block; background: #ecf0f1; padding: 0.25rem 0.5rem; border-radius: 0.25rem; margin-right: 0.5rem;">${task.category}</span>` : ''}
      </p>
      ${task.dueDate ? `
        <p style="color: ${isOverdue ? '#c0392b' : 'var(--text-muted)'}; font-size: 0.85rem; margin: 0.5rem 0; font-weight: ${isOverdue ? '600' : '400'};">
          📅 ${new Date(task.dueDate).toLocaleDateString()}
          ${isOverdue ? ' (OVERDUE)' : ''}
        </p>
      ` : ''}
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem;">
        <div style="font-size: 0.85rem; color: var(--text-muted);">
          Subtasks: ${task.subtasks?.filter(s => s.completed).length || 0}/${task.subtasks?.length || 0}
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn-icon edit-task" data-id="${task.id}" title="Edit">✎</button>
          <button class="btn-icon delete-task" data-id="${task.id}" title="Delete">✕</button>
        </div>
      </div>
    `;

    card.addEventListener('mouseover', () => {
      card.style.boxShadow = 'var(--shadow-md)';
      card.style.transform = 'translateY(-2px)';
    });
    card.addEventListener('mouseout', () => {
      card.style.boxShadow = 'var(--shadow-sm)';
      card.style.transform = 'translateY(0)';
    });

    card.querySelector('.edit-task').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openEditTaskModal(task);
    });

    card.querySelector('.delete-task').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${task.title}"?`)) {
        this.deleteTask(task.id);
      }
    });

    return card;
  },

  openAddTaskModal() {
    const modal = document.querySelector('[data-modal="addTask"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) form.reset();
      modal.style.display = 'flex';
    }
  },

  async submitAddTask(modal) {
    const form = modal.querySelector('form');
    const data = {
      title: form.querySelector('[name="title"]')?.value,
      category: form.querySelector('[name="category"]')?.value,
      dueDate: form.querySelector('[name="dueDate"]')?.value,
      priority: form.querySelector('[name="priority"]')?.value,
      notes: form.querySelector('[name="notes"]')?.value,
      assignees: []
    };

    if (!data.title) {
      showNotification('Task title required', 'error');
      return;
    }

    try {
      await taskModule.addTask(data);
      showNotification('Task added successfully', 'success');
      modal.style.display = 'none';
      await this.loadTasks();
      this.render();
    } catch (error) {
      showNotification('Failed to add task', 'error');
    }
  },

  openEditTaskModal(task) {
    const modal = document.querySelector('[data-modal="editTask"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) {
        form.querySelector('[name="title"]').value = task.title;
        form.querySelector('[name="category"]').value = task.category || '';
        form.querySelector('[name="dueDate"]').value = task.dueDate || '';
        form.querySelector('[name="priority"]').value = task.priority;
        form.querySelector('[name="status"]').value = task.status;
        form.querySelector('[name="notes"]').value = task.notes || '';
      }
      modal.dataset.taskId = task.id;
      modal.style.display = 'flex';
    }
  },

  async submitEditTask(modal) {
    const taskId = modal.dataset.taskId;
    const form = modal.querySelector('form');
    const data = {
      title: form.querySelector('[name="title"]')?.value,
      category: form.querySelector('[name="category"]')?.value,
      dueDate: form.querySelector('[name="dueDate"]')?.value,
      priority: form.querySelector('[name="priority"]')?.value,
      status: form.querySelector('[name="status"]')?.value,
      notes: form.querySelector('[name="notes"]')?.value
    };

    try {
      await taskModule.updateTask(taskId, data);
      showNotification('Task updated', 'success');
      modal.style.display = 'none';
      await this.loadTasks();
      this.render();
    } catch (error) {
      showNotification('Failed to update task', 'error');
    }
  },

  async deleteTask(taskId) {
    try {
      await taskModule.deleteTask(taskId);
      showNotification('Task deleted', 'success');
      await this.loadTasks();
      this.render();
    } catch (error) {
      showNotification('Failed to delete task', 'error');
    }
  }
};

if (typeof window !== 'undefined') {
  window.taskListPage = taskListPage;
}
