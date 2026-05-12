/**
 * Timeline Page Logic
 * Renders milestones in chronological order
 */

const timelinePage = {
  currentFilters: {
    type: '',
    search: ''
  },
  viewMode: 'list',

  async init() {
    this.setupEventListeners();
    await this.loadTimeline();
    this.render();
  },

  setupEventListeners() {
    const timelineView = document.querySelector('[data-view="timeline"]');
    if (!timelineView) return;

    const typeFilter = timelineView.querySelector('.timeline-type-filter');
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        this.currentFilters.type = e.target.value;
        this.applyFilters();
      });
    }

    const addBtn = timelineView.querySelector('.timeline-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddMilestoneModal());
    }

    const addMilestoneModal = document.querySelector('[data-modal="addMilestone"]');
    if (addMilestoneModal) {
      const form = addMilestoneModal.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitAddMilestone(addMilestoneModal);
        });
      }
      const closeBtn = addMilestoneModal.querySelector('.modal-close');
      if (closeBtn) closeBtn.addEventListener('click', () => { addMilestoneModal.style.display = 'none'; });
    }

    const editMilestoneModal = document.querySelector('[data-modal="editMilestone"]');
    if (editMilestoneModal) {
      const form = editMilestoneModal.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitEditMilestone(editMilestoneModal);
        });
      }
      const closeBtn = editMilestoneModal.querySelector('.modal-close');
      if (closeBtn) closeBtn.addEventListener('click', () => { editMilestoneModal.style.display = 'none'; });
    }
  },

  async loadTimeline() {
    try {
      timelineModule.filteredMilestones = await timelineModule.fetch();
    } catch (error) {
      console.error('Failed to load timeline:', error);
    }
  },

  applyFilters() {
    let filtered = timelineModule.milestones || [];
    
    if (this.currentFilters.type) {
      filtered = filtered.filter(m => m.type === this.currentFilters.type);
    }

    if (this.currentFilters.search) {
      const searchLower = this.currentFilters.search.toLowerCase();
      filtered = filtered.filter(m => m.title.toLowerCase().includes(searchLower));
    }

    // Sort by date chronologically
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    timelineModule.filteredMilestones = filtered;
    this.render();
  },

  render() {
    const timelineView = document.querySelector('[data-view="timeline"]');
    if (!timelineView) return;

    this.renderStats();
    this.renderList();
  },

  renderStats() {
    const timelineView = document.querySelector('[data-view="timeline"]');
    const statsContainer = timelineView?.querySelector('.timeline-stats');
    if (!statsContainer) return;

    const summary = timelineModule.getSummary();
    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-number">${summary.total}</div>
        <div class="stat-label">Total Milestones</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${summary.upcoming || 0}</div>
        <div class="stat-label">Upcoming</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${summary.byType['event'] || 0}</div>
        <div class="stat-label">Events</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${summary.byType['deadline'] || 0}</div>
        <div class="stat-label">Deadlines</div>
      </div>
    `;
  },

  renderList() {
    const timelineView = document.querySelector('[data-view="timeline"]');
    const timelineContainer = timelineView?.querySelector('.timeline-container');
    if (!timelineContainer) return;

    if (timelineModule.filteredMilestones.length === 0) {
      timelineContainer.innerHTML = '<p class="empty-state">No milestones found.</p>';
      return;
    }

    const timeline = document.createElement('div');
    timeline.style.cssText = `position: relative; padding: 2rem 0; padding-left: 2rem;`;
    timeline.innerHTML = '<div style="position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: linear-gradient(to bottom, var(--gold), var(--blue)); border-radius: 1px;"></div>';

    timelineModule.filteredMilestones.forEach((milestone, index) => {
      const milestoneEl = document.createElement('div');
      milestoneEl.style.cssText = `margin-bottom: 2rem; position: relative; padding-left: 1.5rem;`;

      const isUpcoming = new Date(milestone.date) > new Date();
      const typeIcon = { 'event': '📅', 'deadline': '⏰', 'reminder': '🔔', 'milestone': '🎯' };
      const icon = typeIcon[milestone.type] || '📌';

      milestoneEl.innerHTML = `
        <div style="position: absolute; left: -0.875rem; top: 0.25rem; width: 1.5rem; height: 1.5rem; background: ${isUpcoming ? 'var(--gold)' : '#27ae60'}; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 0 3px ${isUpcoming ? 'var(--gold)' : '#27ae60'}33;"></div>
        <div style="background: white; padding: 1.25rem; border-radius: 0.75rem; border-left: 4px solid ${isUpcoming ? 'var(--gold)' : '#27ae60'}; box-shadow: var(--shadow-sm); transition: all 0.2s ease;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
            <div>
              <h4 style="color: var(--blue); margin: 0 0 0.25rem 0;">${icon} ${milestone.title}</h4>
              <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0; text-transform: capitalize;">${milestone.type}</p>
            </div>
            <span style="background: ${isUpcoming ? '#f39c12' : '#27ae60'}; color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600;">${isUpcoming ? 'Upcoming' : 'Complete'}</span>
          </div>
          ${milestone.date ? `<p style="color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0;">📅 ${new Date(milestone.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>` : ''}
          ${milestone.location ? `<p style="color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0;">📍 ${milestone.location}</p>` : ''}
          ${milestone.description ? `<p style="color: var(--text); font-size: 0.9rem; margin: 0.75rem 0;">${milestone.description}</p>` : ''}
          ${milestone.attendees && milestone.attendees.length > 0 ? `<p style="color: var(--text-muted); font-size: 0.85rem; margin: 0.5rem 0;">👥 ${milestone.attendees.join(', ')}</p>` : ''}
          <div style="display: flex; gap: 0.5rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #ecf0f1;">
            <button class="btn-icon edit-milestone" data-id="${milestone.id}" title="Edit" style="background: var(--blue); color: white; border: none; padding: 0.4rem 0.6rem; border-radius: 0.3rem; cursor: pointer; font-size: 0.85rem;">✎</button>
            <button class="btn-icon delete-milestone" data-id="${milestone.id}" title="Delete" style="background: #e74c3c; color: white; border: none; padding: 0.4rem 0.6rem; border-radius: 0.3rem; cursor: pointer; font-size: 0.85rem;">✕</button>
          </div>
        </div>
      `;

      milestoneEl.querySelector('.edit-milestone').addEventListener('click', () => this.openEditMilestoneModal(milestone));
      milestoneEl.querySelector('.delete-milestone').addEventListener('click', () => {
        if (confirm(`Delete "${milestone.title}"?`)) { this.deleteMilestone(milestone.id); }
      });

      const card = milestoneEl.querySelector('[style*="background: white"]');
      milestoneEl.addEventListener('mouseover', () => { card.style.boxShadow = 'var(--shadow-md)'; card.style.transform = 'translateX(4px)'; });
      milestoneEl.addEventListener('mouseout', () => { card.style.boxShadow = 'var(--shadow-sm)'; card.style.transform = 'translateX(0)'; });

      timeline.appendChild(milestoneEl);
    });

    timelineContainer.innerHTML = '';
    timelineContainer.appendChild(timeline);
  },

  openAddMilestoneModal() {
    const modal = document.querySelector('[data-modal="addMilestone"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) form.reset();
      modal.style.display = 'flex';
    }
  },

  async submitAddMilestone(modal) {
    const form = modal.querySelector('form');
    const attendeesInput = form.querySelector('[name="attendees"]')?.value || '';
    const attendees = attendeesInput ? attendeesInput.split(',').map(a => a.trim()) : [];

    const data = {
      type: form.querySelector('[name="type"]')?.value,
      title: form.querySelector('[name="title"]')?.value,
      date: form.querySelector('[name="date"]')?.value,
      location: form.querySelector('[name="location"]')?.value,
      description: form.querySelector('[name="description"]')?.value,
      attendees: attendees,
      notes: form.querySelector('[name="notes"]')?.value
    };

    if (!data.type || !data.title || !data.date) {
      showNotification('Type, title, and date required', 'error');
      return;
    }

    try {
      await timelineModule.addMilestone(data);
      showNotification('Milestone added', 'success');
      modal.style.display = 'none';
      await this.loadTimeline();
      this.render();
    } catch (error) {
      showNotification('Failed to add milestone', 'error');
    }
  },

  openEditMilestoneModal(milestone) {
    const modal = document.querySelector('[data-modal="editMilestone"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) {
        form.querySelector('[name="type"]').value = milestone.type;
        form.querySelector('[name="title"]').value = milestone.title;
        form.querySelector('[name="date"]').value = milestone.date || '';
        form.querySelector('[name="location"]').value = milestone.location || '';
        form.querySelector('[name="description"]').value = milestone.description || '';
        form.querySelector('[name="attendees"]').value = (milestone.attendees || []).join(', ');
        form.querySelector('[name="notes"]').value = milestone.notes || '';
      }
      modal.dataset.milestoneId = milestone.id;
      modal.style.display = 'flex';
    }
  },

  async submitEditMilestone(modal) {
    const milestoneId = modal.dataset.milestoneId;
    const form = modal.querySelector('form');
    const attendeesInput = form.querySelector('[name="attendees"]')?.value || '';
    const attendees = attendeesInput ? attendeesInput.split(',').map(a => a.trim()) : [];

    const data = {
      type: form.querySelector('[name="type"]')?.value,
      title: form.querySelector('[name="title"]')?.value,
      date: form.querySelector('[name="date"]')?.value,
      location: form.querySelector('[name="location"]')?.value,
      description: form.querySelector('[name="description"]')?.value,
      attendees: attendees,
      notes: form.querySelector('[name="notes"]')?.value
    };

    try {
      await timelineModule.updateMilestone(milestoneId, data);
      showNotification('Milestone updated', 'success');
      modal.style.display = 'none';
      await this.loadTimeline();
      this.render();
    } catch (error) {
      showNotification('Failed to update milestone', 'error');
    }
  },

  async deleteMilestone(milestoneId) {
    try {
      await timelineModule.deleteMilestone(milestoneId);
      showNotification('Milestone deleted', 'success');
      await this.loadTimeline();
      this.render();
    } catch (error) {
      showNotification('Failed to delete milestone', 'error');
    }
  }
};

window.timelinePage = timelinePage;
