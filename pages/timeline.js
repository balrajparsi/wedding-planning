/**
 * Events Page Logic (formerly Timeline)
 * Renders events/milestones; attendees selected from guest list
 */

const timelinePage = {
  listenersSetup: false,
  currentFilters: { type: '', search: '' },

  async init() {
    if (!this.listenersSetup) {
      this.setupEventListeners();
      this.listenersSetup = true;
    }
    await this.loadTimeline();
    this.render();
  },

  setupEventListeners() {
    const view = document.querySelector('[data-view="timeline"]');
    if (!view) return;

    view.querySelector('.timeline-type-filter')?.addEventListener('change', (e) => {
      this.currentFilters.type = e.target.value;
      this.applyFilters();
    });

    view.querySelector('.timeline-add-btn')?.addEventListener('click', () => this.openAddMilestoneModal());

    const addModal = document.querySelector('[data-modal="addMilestone"]');
    if (addModal) {
      const form = addModal.querySelector('form');
      if (form) form.addEventListener('submit', (e) => { e.preventDefault(); this.submitAddMilestone(addModal); });
      addModal.querySelector('.modal-close')?.addEventListener('click', () => { addModal.style.display = 'none'; });
    }

    const editModal = document.querySelector('[data-modal="editMilestone"]');
    if (editModal) {
      const form = editModal.querySelector('form');
      if (form) form.addEventListener('submit', (e) => { e.preventDefault(); this.submitEditMilestone(editModal); });
      editModal.querySelector('.modal-close')?.addEventListener('click', () => { editModal.style.display = 'none'; });
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
    if (this.currentFilters.type) filtered = filtered.filter(m => m.type === this.currentFilters.type);
    if (this.currentFilters.search) {
      const s = this.currentFilters.search.toLowerCase();
      filtered = filtered.filter(m => m.title.toLowerCase().includes(s));
    }
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    timelineModule.filteredMilestones = filtered;
    this.render();
  },

  render() {
    const view = document.querySelector('[data-view="timeline"]');
    if (!view) return;
    this.renderStats();
    this.renderList();
  },

  renderStats() {
    const view = document.querySelector('[data-view="timeline"]');
    const container = view?.querySelector('.timeline-stats');
    if (!container) return;
    const summary = timelineModule.getSummary();
    container.innerHTML = `
      <div class="stat-card"><div class="stat-number">${summary.total}</div><div class="stat-label">Total Events</div></div>
      <div class="stat-card"><div class="stat-number">${summary.upcoming || 0}</div><div class="stat-label">Upcoming</div></div>
      <div class="stat-card"><div class="stat-number">${summary.byType?.['event'] || 0}</div><div class="stat-label">Events</div></div>
      <div class="stat-card"><div class="stat-number">${summary.byType?.['deadline'] || 0}</div><div class="stat-label">Deadlines</div></div>
    `;
  },

  renderList() {
    const view = document.querySelector('[data-view="timeline"]');
    const container = view?.querySelector('.timeline-container');
    if (!container) return;

    if (!timelineModule.filteredMilestones.length) {
      container.innerHTML = '<p class="empty-state">No events yet. Add your first event to get started.</p>';
      return;
    }

    const timeline = document.createElement('div');
    timeline.style.cssText = 'position:relative;padding:2rem 0;padding-left:2rem;';
    timeline.innerHTML = '<div style="position:absolute;left:0;top:0;bottom:0;width:2px;background:linear-gradient(to bottom,var(--gold),var(--blue));border-radius:1px;"></div>';

    timelineModule.filteredMilestones.forEach(milestone => {
      const el = document.createElement('div');
      el.style.cssText = 'margin-bottom:2rem;position:relative;padding-left:1.5rem;';

      const isUpcoming = new Date(milestone.date) > new Date();
      const typeIcon = { event: '📅', deadline: '⏰', reminder: '🔔', milestone: '🎯' }[milestone.type] || '📌';

      el.innerHTML = `
        <div style="position:absolute;left:-0.875rem;top:0.25rem;width:1.5rem;height:1.5rem;background:${isUpcoming ? 'var(--gold)' : '#27ae60'};border:3px solid white;border-radius:50%;box-shadow:0 0 0 3px ${isUpcoming ? 'var(--gold)' : '#27ae60'}33;"></div>
        <div class="milestone-card" style="background:white;padding:1.25rem;border-radius:0.75rem;border-left:4px solid ${isUpcoming ? 'var(--gold)' : '#27ae60'};box-shadow:var(--shadow-sm);transition:all 0.2s ease;">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.75rem;">
            <div>
              <h4 style="color:var(--blue);margin:0 0 0.25rem 0;">${typeIcon} ${milestone.title}</h4>
              <p style="color:var(--text-muted);font-size:0.85rem;margin:0;text-transform:capitalize;">${milestone.type}</p>
            </div>
            <span style="background:${isUpcoming ? '#f39c12' : '#27ae60'};color:white;padding:0.25rem 0.5rem;border-radius:0.25rem;font-size:0.75rem;font-weight:600;">${isUpcoming ? 'Upcoming' : 'Complete'}</span>
          </div>
          ${milestone.date ? `<p style="color:var(--text-muted);font-size:0.9rem;margin:0.5rem 0;">📅 ${new Date(milestone.date).toLocaleDateString('en-US',{weekday:'short',year:'numeric',month:'short',day:'numeric'})}</p>` : ''}
          ${milestone.location ? `<p style="color:var(--text-muted);font-size:0.9rem;margin:0.5rem 0;">📍 ${milestone.location}</p>` : ''}
          ${milestone.description ? `<p style="color:var(--text);font-size:0.9rem;margin:0.75rem 0;">${milestone.description}</p>` : ''}
          ${milestone.attendees?.length ? `
            <div style="margin:0.5rem 0;">
              <span style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">👥 Attendees: </span>
              ${milestone.attendees.map(a => `<span style="display:inline-block;background:#e8f0fe;color:#2a5f7f;padding:0.15rem 0.4rem;border-radius:0.25rem;font-size:0.78rem;margin:0.1rem;">${a}</span>`).join('')}
            </div>
          ` : ''}
          <div style="display:flex;gap:0.5rem;margin-top:1rem;padding-top:1rem;border-top:1px solid #ecf0f1;">
            <button class="edit-milestone btn-icon" style="background:var(--blue);color:white;border:none;padding:0.4rem 0.6rem;border-radius:0.3rem;cursor:pointer;font-size:0.85rem;">✎ Edit</button>
            <button class="delete-milestone btn-icon" style="background:#e74c3c;color:white;border:none;padding:0.4rem 0.6rem;border-radius:0.3rem;cursor:pointer;font-size:0.85rem;">✕ Delete</button>
          </div>
        </div>
      `;

      const card = el.querySelector('.milestone-card');
      el.addEventListener('mouseover', () => { card.style.boxShadow = 'var(--shadow-md)'; card.style.transform = 'translateX(4px)'; });
      el.addEventListener('mouseout', () => { card.style.boxShadow = 'var(--shadow-sm)'; card.style.transform = 'translateX(0)'; });
      el.querySelector('.edit-milestone').addEventListener('click', () => this.openEditMilestoneModal(milestone));
      el.querySelector('.delete-milestone').addEventListener('click', () => {
        if (confirm(`Delete "${milestone.title}"?`)) this.deleteMilestone(milestone.id);
      });

      timeline.appendChild(el);
    });

    container.innerHTML = '';
    container.appendChild(timeline);
  },

  // Populate the attendees <select multiple> with guest names
  populateAttendeesSelect(modal, selectedNames = []) {
    const select = modal.querySelector('[name="attendees"]');
    if (!select) return;
    const guests = guestModule.guests || [];
    select.innerHTML = guests.length
      ? guests.map(g => `<option value="${g.name}" ${selectedNames.includes(g.name) ? 'selected' : ''}>${g.name}${g.relationship ? ` (${g.relationship})` : ''}</option>`).join('')
      : '<option disabled>No guests added yet</option>';
  },

  openAddMilestoneModal() {
    const modal = document.querySelector('[data-modal="addMilestone"]');
    if (!modal) return;
    modal.querySelector('form')?.reset();
    this.populateAttendeesSelect(modal);
    modal.style.display = 'flex';
  },

  async submitAddMilestone(modal) {
    const form = modal.querySelector('form');
    const selectedAttendees = [...(form.querySelector('[name="attendees"]')?.selectedOptions || [])].map(o => o.value);

    const data = {
      type:        form.querySelector('[name="type"]')?.value,
      title:       form.querySelector('[name="title"]')?.value,
      date:        form.querySelector('[name="date"]')?.value,
      location:    form.querySelector('[name="location"]')?.value,
      description: form.querySelector('[name="description"]')?.value,
      attendees:   selectedAttendees,
      notes:       form.querySelector('[name="notes"]')?.value
    };

    if (!data.type || !data.title || !data.date) { showNotification('Type, title, and date required', 'error'); return; }

    try {
      await timelineModule.addMilestone(data);
      showNotification('Event added', 'success');
      modal.style.display = 'none';
      await this.loadTimeline();
      this.render();
    } catch (error) {
      showNotification('Failed to add event', 'error');
    }
  },

  openEditMilestoneModal(milestone) {
    const modal = document.querySelector('[data-modal="editMilestone"]');
    if (!modal) return;
    const form = modal.querySelector('form');
    if (form) {
      form.querySelector('[name="type"]').value        = milestone.type;
      form.querySelector('[name="title"]').value       = milestone.title;
      form.querySelector('[name="date"]').value        = milestone.date || '';
      form.querySelector('[name="location"]').value    = milestone.location || '';
      form.querySelector('[name="description"]').value = milestone.description || '';
      form.querySelector('[name="notes"]').value       = milestone.notes || '';
    }
    this.populateAttendeesSelect(modal, milestone.attendees || []);
    modal.dataset.milestoneId = milestone.id;
    modal.style.display = 'flex';
  },

  async submitEditMilestone(modal) {
    const milestoneId = modal.dataset.milestoneId;
    const form = modal.querySelector('form');
    const selectedAttendees = [...(form.querySelector('[name="attendees"]')?.selectedOptions || [])].map(o => o.value);

    const data = {
      type:        form.querySelector('[name="type"]')?.value,
      title:       form.querySelector('[name="title"]')?.value,
      date:        form.querySelector('[name="date"]')?.value,
      location:    form.querySelector('[name="location"]')?.value,
      description: form.querySelector('[name="description"]')?.value,
      attendees:   selectedAttendees,
      notes:       form.querySelector('[name="notes"]')?.value
    };

    try {
      await timelineModule.updateMilestone(milestoneId, data);
      showNotification('Event updated', 'success');
      modal.style.display = 'none';
      await this.loadTimeline();
      this.render();
    } catch (error) {
      showNotification('Failed to update event', 'error');
    }
  },

  async deleteMilestone(milestoneId) {
    try {
      await timelineModule.deleteMilestone(milestoneId);
      showNotification('Event deleted', 'success');
      await this.loadTimeline();
      this.render();
    } catch (error) {
      showNotification('Failed to delete event', 'error');
    }
  }
};

window.timelinePage = timelinePage;
