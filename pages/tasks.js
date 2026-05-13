/**
 * Task Board Page Logic
 * Kanban with drag-and-drop + expandable subtasks with yes/no/notes
 */

const taskListPage = {
  listenersSetup: false,
  currentFilters: {
    category: '',
    status: '',
    assignee: '',
    sortBy: 'dueDate'
  },
  viewMode: 'kanban',
  draggedTaskId: null,

  async init() {
    if (!this.listenersSetup) {
      this.setupEventListeners();
      this.listenersSetup = true;
    }
    await this.loadTasks();
    this.render();
  },

  setupEventListeners() {
    const taskView = document.querySelector('[data-view="tasks"]');
    if (!taskView) return;

    taskView.querySelector('.task-category-filter')?.addEventListener('change', (e) => {
      this.currentFilters.category = e.target.value;
      this.applyFilters();
    });

    taskView.querySelector('.task-status-filter')?.addEventListener('change', (e) => {
      this.currentFilters.status = e.target.value;
      this.applyFilters();
    });

    taskView.querySelector('.task-add-btn')?.addEventListener('click', () => this.openAddTaskModal());

    taskView.querySelector('.task-view-toggle')?.addEventListener('click', () => {
      this.viewMode = this.viewMode === 'kanban' ? 'list' : 'kanban';
      this.render();
    });

    const addTaskModal = document.querySelector('[data-modal="addTask"]');
    if (addTaskModal) {
      const btn = addTaskModal.querySelector('button[type="submit"]');
      if (btn) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => { e.preventDefault(); this.submitAddTask(addTaskModal); });
      }
    }

    const editTaskModal = document.querySelector('[data-modal="editTask"]');
    if (editTaskModal) {
      const btn = editTaskModal.querySelector('button[type="submit"]');
      if (btn) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => { e.preventDefault(); this.submitEditTask(editTaskModal); });
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
      <div class="stat-card"><div class="stat-value">${stats.total}</div><div class="stat-label">Total Tasks</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#f39c12">${stats.pending}</div><div class="stat-label">Pending</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#3498db">${stats.inProgress}</div><div class="stat-label">In Progress</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#27ae60">${stats.completed}</div><div class="stat-label">Completed</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#c0392b">${stats.overdue}</div><div class="stat-label">Overdue</div></div>
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
    board.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;min-height:500px;';

    statuses.forEach(status => {
      const tasks = taskModule.filteredTasks.filter(t => t.status === status);
      const column = document.createElement('div');
      column.className = 'kanban-column';
      column.dataset.status = status;
      column.style.cssText = `background:var(--cream);border-radius:0.75rem;padding:1.5rem;border-left:4px solid ${statusColors[status]};min-height:300px;transition:background 0.2s;`;

      column.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
          <h4 style="color:var(--blue);margin:0">${statusLabels[status]}</h4>
          <span style="background:${statusColors[status]};color:white;padding:0.25rem 0.75rem;border-radius:0.5rem;font-size:0.85rem;font-weight:600;">${tasks.length}</span>
        </div>
        <div class="tasks-list" style="display:flex;flex-direction:column;gap:1rem;"></div>
      `;

      const tasksList = column.querySelector('.tasks-list');
      tasks.forEach(task => tasksList.appendChild(this.createTaskCard(task)));

      // Drag-and-drop column events
      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        column.style.background = '#e8f0fe';
      });
      column.addEventListener('dragleave', () => {
        column.style.background = 'var(--cream)';
      });
      column.addEventListener('drop', async (e) => {
        e.preventDefault();
        column.style.background = 'var(--cream)';
        const taskId = e.dataTransfer.getData('text/plain');
        if (!taskId) return;
        try {
          await taskModule.updateTask(taskId, { status });
          showNotification(`Moved to ${statusLabels[status]}`, 'success');
          await this.loadTasks();
          this.render();
        } catch (err) {
          showNotification('Failed to move task', 'error');
        }
      });

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
      listContainer.innerHTML = '<p class="empty-state">No tasks found.</p>';
      return;
    }

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:1rem;';
    taskModule.filteredTasks.forEach(task => list.appendChild(this.createTaskCard(task)));
    listContainer.innerHTML = '';
    listContainer.appendChild(list);
  },

  createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.taskId = task.id;
    card.style.cssText = 'background:white;padding:1rem;border-radius:0.5rem;border-left:3px solid var(--gold);box-shadow:var(--shadow-sm);cursor:grab;transition:all 0.2s ease;';

    const priorityColor = { high: '#c0392b', medium: '#f39c12', low: '#27ae60' }[task.priority] || '#95a5a6';
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const isOverdue = dueDate && dueDate < new Date() && task.status !== 'completed';
    const subtasks = task.subtasks || [];
    const completedSubs = subtasks.filter(s => s.completed).length;

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.5rem;">
        <h4 style="color:var(--blue);margin:0;flex:1;">${task.title}</h4>
        <span style="background:${priorityColor};color:white;padding:0.25rem 0.5rem;border-radius:0.25rem;font-size:0.75rem;font-weight:600;white-space:nowrap;margin-left:0.5rem;">${task.priority.toUpperCase()}</span>
      </div>
      <p style="color:var(--text-muted);font-size:0.85rem;margin:0.5rem 0;">
        ${task.category ? `<span style="display:inline-block;background:#ecf0f1;padding:0.2rem 0.5rem;border-radius:0.25rem;">${task.category}</span>` : ''}
      </p>
      ${task.dueDate ? `<p style="color:${isOverdue ? '#c0392b' : 'var(--text-muted)'};font-size:0.85rem;margin:0.5rem 0;font-weight:${isOverdue ? '600' : '400'};">📅 ${new Date(task.dueDate).toLocaleDateString()}${isOverdue ? ' (OVERDUE)' : ''}</p>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.75rem;">
        <button class="expand-subtasks-btn" style="background:none;border:none;cursor:pointer;font-size:0.8rem;color:var(--blue);padding:0;">
          📋 Subtasks ${completedSubs}/${subtasks.length} ${subtasks.length > 0 ? '▼' : ''}
        </button>
        <div style="display:flex;gap:0.5rem;">
          <button class="btn-icon edit-task" data-id="${task.id}" title="Edit">✎</button>
          <button class="btn-icon delete-task" data-id="${task.id}" title="Delete" style="color:#c0392b">✕</button>
        </div>
      </div>
      <div class="subtasks-panel" style="display:none;margin-top:1rem;border-top:1px solid #ecf0f1;padding-top:1rem;">
        <div class="subtasks-list"></div>
        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
          <input type="text" class="new-subtask-input" placeholder="Add subtask..." style="flex:1;padding:0.4rem 0.6rem;border:1px solid #ddd;border-radius:0.3rem;font-size:0.85rem;">
          <button class="add-subtask-btn" style="background:var(--blue);color:white;border:none;padding:0.4rem 0.75rem;border-radius:0.3rem;cursor:pointer;font-size:0.85rem;">+</button>
        </div>
      </div>
    `;

    // Drag events
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', task.id);
      card.style.opacity = '0.5';
    });
    card.addEventListener('dragend', () => { card.style.opacity = '1'; });

    // Hover effects
    card.addEventListener('mouseover', () => { card.style.boxShadow = 'var(--shadow-md)'; card.style.transform = 'translateY(-2px)'; });
    card.addEventListener('mouseout', () => { card.style.boxShadow = 'var(--shadow-sm)'; card.style.transform = 'translateY(0)'; });

    // Expand/collapse subtasks
    const expandBtn = card.querySelector('.expand-subtasks-btn');
    const subtasksPanel = card.querySelector('.subtasks-panel');
    expandBtn.addEventListener('click', () => {
      const isOpen = subtasksPanel.style.display !== 'none';
      subtasksPanel.style.display = isOpen ? 'none' : 'block';
      expandBtn.textContent = `📋 Subtasks ${completedSubs}/${subtasks.length} ${subtasks.length > 0 ? (isOpen ? '▼' : '▲') : ''}`;
      if (!isOpen) this.renderSubtasks(task, card);
    });

    // Edit / Delete
    card.querySelector('.edit-task').addEventListener('click', (e) => { e.stopPropagation(); this.openEditTaskModal(task); });
    card.querySelector('.delete-task').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${task.title}"?`)) this.deleteTask(task.id);
    });

    // Add subtask
    const addSubBtn = card.querySelector('.add-subtask-btn');
    const newSubInput = card.querySelector('.new-subtask-input');
    addSubBtn.addEventListener('click', () => this.addSubtaskToCard(task, newSubInput, card));
    newSubInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addSubtaskToCard(task, newSubInput, card); });

    return card;
  },

  renderSubtasks(task, card) {
    const list = card.querySelector('.subtasks-list');
    if (!list) return;
    const subtasks = task.subtasks || [];

    if (subtasks.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;margin:0;">No subtasks yet.</p>';
      return;
    }

    list.innerHTML = '';
    subtasks.forEach(sub => {
      const item = document.createElement('div');
      item.style.cssText = 'background:#f8f9fa;border-radius:0.4rem;padding:0.75rem;margin-bottom:0.5rem;';

      const responseColor = { yes: '#27ae60', no: '#c0392b' }[sub.response] || '#95a5a6';
      const responseLabel = { yes: '✅ Yes', no: '❌ No' }[sub.response] || '—';

      item.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.5rem;">
          <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.875rem;flex:1;">
            <input type="checkbox" class="sub-complete-cb" ${sub.completed ? 'checked' : ''} style="width:1rem;height:1rem;">
            <span style="${sub.completed ? 'text-decoration:line-through;color:#aaa' : ''}">${sub.title}</span>
          </label>
          <span style="background:${responseColor};color:white;padding:0.15rem 0.4rem;border-radius:0.2rem;font-size:0.75rem;white-space:nowrap;">${responseLabel}</span>
        </div>
        <div style="display:flex;gap:0.4rem;margin-bottom:0.5rem;flex-wrap:wrap;">
          <button class="sub-yes-btn" style="background:${sub.response === 'yes' ? '#27ae60' : '#ecf0f1'};color:${sub.response === 'yes' ? 'white' : '#555'};border:none;padding:0.3rem 0.75rem;border-radius:0.25rem;cursor:pointer;font-size:0.8rem;font-weight:600;">✅ Yes</button>
          <button class="sub-no-btn" style="background:${sub.response === 'no' ? '#c0392b' : '#ecf0f1'};color:${sub.response === 'no' ? 'white' : '#555'};border:none;padding:0.3rem 0.75rem;border-radius:0.25rem;cursor:pointer;font-size:0.8rem;font-weight:600;">❌ No</button>
        </div>
        <div style="display:flex;gap:0.4rem;">
          <input type="text" class="sub-notes-input" value="${sub.notes || ''}" placeholder="Add notes..." style="flex:1;padding:0.3rem 0.5rem;border:1px solid #ddd;border-radius:0.25rem;font-size:0.8rem;">
          <button class="sub-notes-save" style="background:var(--gold);color:white;border:none;padding:0.3rem 0.6rem;border-radius:0.25rem;cursor:pointer;font-size:0.8rem;">Save</button>
        </div>
      `;

      // Complete checkbox
      item.querySelector('.sub-complete-cb').addEventListener('change', async (e) => {
        await this.updateSubtask(task.id, sub.id, { completed: e.target.checked });
      });

      // Yes / No buttons
      item.querySelector('.sub-yes-btn').addEventListener('click', async () => {
        await this.updateSubtask(task.id, sub.id, { response: 'yes', completed: true });
      });
      item.querySelector('.sub-no-btn').addEventListener('click', async () => {
        await this.updateSubtask(task.id, sub.id, { response: 'no' });
      });

      // Notes save
      item.querySelector('.sub-notes-save').addEventListener('click', async () => {
        const notes = item.querySelector('.sub-notes-input').value;
        await this.updateSubtask(task.id, sub.id, { notes });
      });

      list.appendChild(item);
    });
  },

  async addSubtaskToCard(task, input, card) {
    const title = input.value.trim();
    if (!title) return;
    try {
      const newSub = await taskModule.addSubtask(task.id, title);
      task.subtasks = task.subtasks || [];
      task.subtasks.push(newSub);
      input.value = '';
      this.renderSubtasks(task, card);
      // Update count on button
      const expandBtn = card.querySelector('.expand-subtasks-btn');
      const completed = task.subtasks.filter(s => s.completed).length;
      expandBtn.textContent = `📋 Subtasks ${completed}/${task.subtasks.length} ▲`;
      showNotification('Subtask added', 'success');
    } catch (err) {
      showNotification('Failed to add subtask', 'error');
    }
  },

  async updateSubtask(taskId, subtaskId, updates) {
    try {
      const updated = await taskModule.updateSubtask(taskId, subtaskId, updates);
      // Refresh in-memory task
      const task = taskModule.tasks.find(t => t.id === taskId);
      if (task) {
        const sub = task.subtasks?.find(s => s.id === subtaskId);
        if (sub) Object.assign(sub, updated);
      }
      // Re-render the card
      await this.loadTasks();
      this.render();
    } catch (err) {
      showNotification('Failed to update subtask', 'error');
    }
  },

  openAddTaskModal() {
    const modal = document.querySelector('[data-modal="addTask"]');
    if (!modal) return;
    modal.querySelector('form')?.reset();
    modal.style.display = 'flex';

    const btn = modal.querySelector('button[type="submit"]');
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', (e) => { e.preventDefault(); this.submitAddTask(modal); });
    }
  },

  async submitAddTask(modal) {
    const form = modal.querySelector('form');
    const data = {
      title:    form.querySelector('[name="title"]')?.value,
      category: form.querySelector('[name="category"]')?.value,
      dueDate:  form.querySelector('[name="dueDate"]')?.value,
      priority: form.querySelector('[name="priority"]')?.value,
      notes:    form.querySelector('[name="notes"]')?.value,
      assignees: []
    };
    if (!data.title) { showNotification('Task title required', 'error'); return; }
    try {
      await taskModule.addTask(data);
      showNotification('Task added', 'success');
      modal.style.display = 'none';
      await this.loadTasks();
      this.render();
    } catch (error) {
      showNotification('Failed to add task', 'error');
    }
  },

  openEditTaskModal(task) {
    const modal = document.querySelector('[data-modal="editTask"]');
    if (!modal) return;
    const form = modal.querySelector('form');
    if (form) {
      form.querySelector('[name="title"]').value    = task.title;
      form.querySelector('[name="category"]').value = task.category || '';
      form.querySelector('[name="dueDate"]').value  = task.dueDate || '';
      form.querySelector('[name="priority"]').value = task.priority;
      form.querySelector('[name="status"]').value   = task.status;
      form.querySelector('[name="notes"]').value    = task.notes || '';
    }
    modal.dataset.taskId = task.id;
    modal.style.display = 'flex';

    const btn = modal.querySelector('button[type="submit"]');
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', (e) => { e.preventDefault(); this.submitEditTask(modal); });
    }
  },

  async submitEditTask(modal) {
    const taskId = modal.dataset.taskId;
    const form = modal.querySelector('form');
    const data = {
      title:    form.querySelector('[name="title"]')?.value,
      category: form.querySelector('[name="category"]')?.value,
      dueDate:  form.querySelector('[name="dueDate"]')?.value,
      priority: form.querySelector('[name="priority"]')?.value,
      status:   form.querySelector('[name="status"]')?.value,
      notes:    form.querySelector('[name="notes"]')?.value
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

if (typeof window !== 'undefined') window.taskListPage = taskListPage;
