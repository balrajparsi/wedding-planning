/**
 * Guest List Page Logic
 */

const guestListPage = {
  listenersSetup: false, // prevents stacking listeners on repeated navigation

  currentFilters: {
    rsvpStatus: '',
    search: '',
    sortBy: 'name',
    sortDir: 'asc'
  },

  rsvpSummary: [],
  publicRsvpUrl: 'https://akhila-akshay-rsvp.vercel.app/',

  guestEventNames: [
    'Haldi',
    'Sangeet',
    'Pellikuthuru',
    'Marriage',
    'Satyanarayana Swamy Vratam'
  ],

  guestEventAliases: [
    { name: 'Haldi', pattern: /\bhaldi\b/i },
    { name: 'Sangeet', pattern: /\bsangeeth?\b/i },
    { name: 'Pellikuthuru', pattern: /\b(pellikuthuru|pelli\s*kuthuru|pellikoduku|pelli\s*koduku|nalugu|mehendi)\b/i },
    { name: 'Marriage', pattern: /\b(marriage|wedding|ceremony|muhurtham)\b/i },
    { name: 'Satyanarayana Swamy Vratam', pattern: /\b(satyanarayana|vratam)\b/i }
  ],

  async init() {
    // Only wire up listeners once — fixes 7× CSV download bug
    if (!this.listenersSetup) {
      this.setupEventListeners();
      this.listenersSetup = true;
    }
    await this.loadGuests();
    this.render();
  },

  setupEventListeners() {
    const view = document.querySelector('[data-view="guests"]');
    if (!view) return;

    // Search
    view.querySelector('.guest-search')?.addEventListener('input', (e) => {
      this.currentFilters.search = e.target.value;
      this.applyFilters();
    });

    // RSVP filter
    view.querySelector('.guest-rsvp-filter')?.addEventListener('change', (e) => {
      this.currentFilters.rsvpStatus = e.target.value;
      this.applyFilters();
    });

    // Clear filters
    view.querySelector('.guest-clear-btn')?.addEventListener('click', () => {
      this.currentFilters = { rsvpStatus: '', search: '', sortBy: 'name', sortDir: 'asc' };
      view.querySelector('.guest-search').value = '';
      view.querySelector('.guest-rsvp-filter').value = '';
      guestModule.filteredGuests = [...guestModule.guests];
      this.render();
    });

    // Add guest
    view.querySelector('.guest-add-btn')?.addEventListener('click', () => this.openAddGuestModal());

    // Export CSV
    view.querySelector('.guest-export-btn')?.addEventListener('click', () => this.exportGuests());

    // Bulk invite
    view.querySelector('.guest-bulk-invite-btn')?.addEventListener('click', () => this.openBulkInviteModal());

    view.querySelector('.guest-copy-rsvp-btn')?.addEventListener('click', () => this.copyPublicRsvpLink());

    // Import guest list
    view.querySelector('.guest-import-btn')?.addEventListener('click', () => {
      const input = view.querySelector('.guest-import-input');
      if (!input) return;
      input.value = '';
      input.click();
    });

    view.querySelector('.guest-import-input')?.addEventListener('change', (e) => this.importGuestFile(e));

    // Reset all (testing)
    view.querySelector('.guest-reset-btn')?.addEventListener('click', () => this.resetAllGuests());
  },

  async loadGuests() {
    try {
      const response = await apiCall('/api/guests', 'GET');
      guestModule.guests = response.guests || [];
      guestModule.stats  = response.stats  || {};
      this.publicRsvpUrl = response.publicRsvpUrl || this.publicRsvpUrl;
      try {
        const summary = await apiCall('/api/guests?action=rsvp-summary', 'GET');
        this.rsvpSummary = summary.events || [];
      } catch (_) {
        this.rsvpSummary = [];
      }
      // Always sync filteredGuests after a fresh fetch
      guestModule.filteredGuests = [...guestModule.guests];
    } catch (error) {
      showNotification('Failed to load guests', 'error');
      guestModule.guests = [];
      guestModule.filteredGuests = [];
      this.rsvpSummary = [];
    }
  },

  applyFilters() {
    guestModule.filter(this.currentFilters);
    this.render();
  },

  render() {
    this.renderStats();
    this.renderEventRsvpSummary();
    this.renderTable();
  },

  renderStats() {
    const view = document.querySelector('[data-view="guests"]');
    const container = view?.querySelector('.guest-stats');
    if (!container) return;

    const g = guestModule.guests;
    const total       = g.length;
    const accepted    = g.filter(x => x.rsvpStatus === 'accepted').length;
    const pending     = g.filter(x => x.rsvpStatus === 'pending').length;
    const declined    = g.filter(x => x.rsvpStatus === 'declined').length;
    const maybe       = g.filter(x => x.rsvpStatus === 'maybe').length;

    container.innerHTML = `
      <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total Guests</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#27ae60">${accepted}</div><div class="stat-label">Accepted</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#f39c12">${pending}</div><div class="stat-label">Pending</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#c0392b">${declined}</div><div class="stat-label">Declined</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#8e44ad">${maybe}</div><div class="stat-label">Maybe</div></div>
    `;
  },

  renderEventRsvpSummary() {
    const view = document.querySelector('[data-view="guests"]');
    const container = view?.querySelector('.guest-event-rsvp-summary');
    if (!container) return;
    const events = this.rsvpSummary || [];
    if (!events.length) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:1rem;align-items:baseline;margin-bottom:.7rem;">
        <div><h3 style="margin:0;color:var(--blue);">Event-by-Event Attendance & Meals</h3><p style="margin:.25rem 0 0;color:var(--text-muted);font-size:.82rem;">Each event uses its own RSVP count; meal totals do not carry over from another event.</p></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:1rem;">
        ${events.map(event => {
          const vegetarianOnly = event.mealPolicy === 'vegetarian-only';
          return `<article class="card" style="margin:0;border-left:3px solid var(--gold);">
            <h4 style="margin:0 0 .65rem;color:var(--blue);">${event.name}</h4>
            <div style="display:grid;gap:.38rem;font-size:.84rem;line-height:1.4;">
              <span><strong>${event.confirmedGuests || 0}</strong> confirmed attending</span>
              <span style="color:#278a4b;"><strong>${event.vegetarianMeals || 0}</strong> ${vegetarianOnly ? 'vegetarian meals' : 'vegetarian'}</span>
              ${vegetarianOnly ? '' : `<span style="color:#c0392b;"><strong>${event.nonVegetarianMeals || 0}</strong> non-vegetarian</span>`}
              <span style="color:#8e44ad;"><strong>${event.maybeGuests || 0}</strong> maybe replies</span>
            </div>
          </article>`;
        }).join('')}
      </div>`;
  },

  renderTable() {
    const view = document.querySelector('[data-view="guests"]');
    const container = view?.querySelector('.guest-table-container');
    if (!container) return;

    const guests = guestModule.filteredGuests;

    if (!guests || guests.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:3rem;color:var(--text-muted);">
          <p style="font-size:1rem;">No guests found. Add your first guest to get started.</p>
        </div>`;
      return;
    }

    const tbody = guests.map(g => {
      const eventTags = this.renderEventTags(g);
      const rsvpDetails = this.renderRsvpDetails(g);
      return `
      <tr>
        <td><strong>${g.name || '—'}</strong></td>
        <td>${g.email || '—'}</td>
        <td>${g.phone || '—'}</td>
        <td>${this.displayGuestSide(g.side) || '—'}</td>
        <td style="text-align:center">${g.partySize || 1}</td>
        <td>${eventTags || '<span style="color:#aaa;font-size:0.8rem;">—</span>'}</td>
        <td><span class="badge badge-${g.rsvpStatus}">${g.rsvpStatus}</span></td>
        <td>${rsvpDetails}</td>
        <td><span style="font-size:0.75rem;color:var(--text-muted);">${g.lastRsvpSource === 'public_rsvp' || g.source === 'public_rsvp' ? 'Public RSVP' : 'Dashboard'}</span></td>
        <td>
          <button class="btn-icon" onclick="guestListPage.openEditGuestModal(${JSON.stringify(g).replace(/"/g, '&quot;')})" title="Edit">✎</button>
          <button class="btn-icon" style="color:#c0392b" onclick="guestListPage.deleteGuest('${g.id}')" title="Delete">✕</button>
        </td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <table class="guest-table" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="cursor:pointer" onclick="guestListPage.sortBy('name')">Name ↕</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Side</th>
            <th>Party Size</th>
            <th>Events</th>
            <th style="cursor:pointer" onclick="guestListPage.sortBy('rsvpStatus')">RSVP ↕</th>
            <th>Event RSVP & Meals</th>
            <th>Source</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>`;
  },

  sortBy(field) {
    if (this.currentFilters.sortBy === field) {
      this.currentFilters.sortDir = this.currentFilters.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentFilters.sortBy = field;
      this.currentFilters.sortDir = 'asc';
    }
    this.applyFilters();
  },

  setupGuestEventChecklist(modal) {
    const checklist = modal.querySelector('[data-guest-event-checklist]');
    if (!checklist || checklist.dataset.ready === 'true') return;

    const allCheckbox = checklist.querySelector('[data-guest-event-all]');
    const eventCheckboxes = [...checklist.querySelectorAll('[name="events"]')];

    allCheckbox?.addEventListener('change', () => {
      eventCheckboxes.forEach(checkbox => {
        checkbox.checked = allCheckbox.checked;
      });
      allCheckbox.indeterminate = false;
    });

    eventCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => this.syncGuestEventAllCheckbox(checklist));
    });

    checklist.dataset.ready = 'true';
  },

  syncGuestEventAllCheckbox(checklist) {
    const allCheckbox = checklist?.querySelector('[data-guest-event-all]');
    const eventCheckboxes = [...(checklist?.querySelectorAll('[name="events"]') || [])];
    if (!allCheckbox || eventCheckboxes.length === 0) return;

    const checkedCount = eventCheckboxes.filter(checkbox => checkbox.checked).length;
    allCheckbox.checked = checkedCount === eventCheckboxes.length;
    allCheckbox.indeterminate = checkedCount > 0 && checkedCount < eventCheckboxes.length;
  },

  setGuestEventSelections(form, input) {
    const events = this.normalizeEvents(input);
    const selectedEvents = events.length ? events : [...this.guestEventNames];

    form.querySelectorAll('[name="events"]').forEach(checkbox => {
      checkbox.checked = selectedEvents.includes(checkbox.value);
    });
    this.syncGuestEventAllCheckbox(form.querySelector('[data-guest-event-checklist]'));
  },

  getSelectedGuestEvents(form) {
    return [...form.querySelectorAll('[name="events"]:checked')].map(checkbox => checkbox.value);
  },

  getGuestEvents(guest) {
    const events = this.normalizeEvents(guest?.events || []);
    return events.length ? events : [...this.guestEventNames];
  },

  isAllGuestEvents(events) {
    return this.guestEventNames.every(eventName => events.includes(eventName));
  },

  renderEventTags(guest) {
    const events = this.getGuestEvents(guest);
    if (this.isAllGuestEvents(events)) {
      return '<span style="display:inline-block;background:#f8f0d8;color:#8c5f11;padding:0.15rem 0.45rem;border-radius:0.25rem;font-size:0.72rem;margin:0.1rem;font-weight:600;">All Events</span>';
    }

    return events
      .map(ev => `<span style="display:inline-block;background:#e8f0fe;color:#2a5f7f;padding:0.15rem 0.4rem;border-radius:0.25rem;font-size:0.72rem;margin:0.1rem;">${ev}</span>`)
      .join('');
  },

  renderRsvpDetails(guest) {
    const responses = guest.eventResponses || {};
    const details = this.guestEventNames.map(name => {
      const raw = responses[name];
      const response = typeof raw === 'object' ? raw.response : raw;
      if (response === 'attending') {
        const attending = parseInt(raw.attendanceCount, 10) || parseInt(guest.partySize, 10) || 1;
        const veg = parseInt(raw.vegetarianCount, 10) || 0;
        const nonVeg = parseInt(raw.nonVegetarianCount, 10) || 0;
        return `<div style="font-size:0.72rem;line-height:1.45;"><strong>${name}</strong>: Yes · ${attending} (${veg} V / ${nonVeg} NV)</div>`;
      }
      if (response === 'maybe') return `<div style="font-size:0.72rem;line-height:1.45;"><strong>${name}</strong>: Maybe</div>`;
      if (response === 'not_attending') return `<div style="font-size:0.72rem;line-height:1.45;"><strong>${name}</strong>: No</div>`;
      return '';
    }).filter(Boolean);
    return details.join('') || '<span style="color:#aaa;font-size:0.8rem;">No event response</span>';
  },

  async copyPublicRsvpLink() {
    const link = this.publicRsvpUrl || 'https://akhila-akshay-rsvp.vercel.app/';
    try {
      await navigator.clipboard.writeText(link);
      showNotification('Public RSVP link copied — ready to share on WhatsApp.', 'success');
    } catch (_) {
      window.prompt('Copy this public RSVP link:', link);
    }
  },

  renderManualEventResponses(form, guest = {}) {
    const existing = guest.eventResponses || {};
    const html = this.guestEventNames.map(name => {
      const raw = existing[name] || {};
      const response = typeof raw === 'object' ? raw.response : raw || 'pending';
      const attending = parseInt(raw.attendanceCount, 10) || parseInt(guest.partySize, 10) || 1;
      const veg = parseInt(raw.vegetarianCount, 10) || 0;
      const nonVeg = parseInt(raw.nonVegetarianCount, 10) || 0;
      return `<div data-manual-rsvp-event="${name}" style="display:grid;grid-template-columns:1.3fr 1fr repeat(3,.8fr);gap:.45rem;align-items:end;margin:.5rem 0;padding:.55rem;border:1px solid rgba(184,134,11,.2);">
        <strong style="font-size:.8rem;">${name}</strong>
        <label style="font-size:.68rem;">Response<select data-response><option value="pending" ${response === 'pending' ? 'selected' : ''}>No response</option><option value="attending" ${response === 'attending' ? 'selected' : ''}>Yes</option><option value="maybe" ${response === 'maybe' ? 'selected' : ''}>Maybe</option><option value="not_attending" ${response === 'not_attending' ? 'selected' : ''}>No</option></select></label>
        <label style="font-size:.68rem;">Guests<input data-count="attendanceCount" type="text" inputmode="numeric" pattern="[0-9]*" value="${response === 'attending' ? attending : 0}"></label>
        <label style="font-size:.68rem;">Veg<input data-count="vegetarianCount" type="text" inputmode="numeric" pattern="[0-9]*" value="${response === 'attending' ? veg : 0}"></label>
        <label style="font-size:.68rem;">Non-veg<input data-count="nonVegetarianCount" type="text" inputmode="numeric" pattern="[0-9]*" value="${response === 'attending' ? nonVeg : 0}"></label>
      </div>`;
    }).join('');
    let container = form.querySelector('[data-manual-rsvp-events]');
    if (!container) {
      container = document.createElement('section');
      container.dataset.manualRsvpEvents = 'true';
      container.innerHTML = '<label style="margin-top:1rem;">Per-Event RSVP & Meals</label><p style="font-size:.75rem;color:var(--text-muted);">For Yes, vegetarian + non-vegetarian must equal guests.</p><div data-manual-rsvp-list></div>';
      form.querySelector('[name="notes"]')?.closest('label')?.before(container);
      if (!container.parentNode) form.insertBefore(container, form.querySelector('[name="notes"]'));
    }
    container.querySelector('[data-manual-rsvp-list]').innerHTML = html;
  },

  getManualEventResponses(form) {
    const responses = {};
    for (const row of form.querySelectorAll('[data-manual-rsvp-event]')) {
      const name = row.dataset.manualRsvpEvent;
      const response = row.querySelector('[data-response]').value;
      const value = key => Math.max(0, parseInt(row.querySelector(`[data-count="${key}"]`)?.value, 10) || 0);
      const attendanceCount = value('attendanceCount');
      const vegetarianCount = value('vegetarianCount');
      const nonVegetarianCount = value('nonVegetarianCount');
      if (response === 'attending' && (!attendanceCount || vegetarianCount + nonVegetarianCount !== attendanceCount)) {
        throw new Error(`${name}: vegetarian and non-vegetarian meals must equal guests.`);
      }
      responses[name] = response === 'attending'
        ? { response, attendanceCount, vegetarianCount, nonVegetarianCount }
        : { response };
    }
    return responses;
  },

  deriveRsvpStatus(eventResponses) {
    const values = Object.values(eventResponses);
    if (values.some(value => value.response === 'attending')) return 'accepted';
    if (values.some(value => value.response === 'maybe')) return 'maybe';
    if (values.some(value => value.response === 'pending')) return 'pending';
    return 'declined';
  },

  /* ── MODALS ── */
  openAddGuestModal() {
    const modal = document.querySelector('[data-modal="addGuest"]');
    if (!modal) return;
    this.setupGuestEventChecklist(modal);
    const form = modal.querySelector('form');
    form?.reset();
    if (form) {
      this.setGuestEventSelections(form, this.guestEventNames);
      this.renderManualEventResponses(form);
    }
    modal.style.display = 'flex';

    // Use { once: true } so listener doesn't stack
    const btn = modal.querySelector('button[type="submit"]');
    if (btn) {
      const newBtn = btn.cloneNode(true); // removes all old listeners
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.submitAddGuest(modal);
      });
    }
  },

  async submitAddGuest(modal) {
    const form = modal.querySelector('form');
    const events = this.getSelectedGuestEvents(form);
    let eventResponses;
    try {
      eventResponses = this.getManualEventResponses(form);
    } catch (error) {
      showNotification(error.message, 'error');
      return;
    }
    const data = {
      name:                 form.querySelector('[name="name"]')?.value?.trim(),
      email:                form.querySelector('[name="email"]')?.value?.trim(),
      phone:                form.querySelector('[name="phone"]')?.value?.trim(),
      side:                 form.querySelector('[name="side"]')?.value,
      partySize:            parseInt(form.querySelector('[name="partySize"]')?.value, 10) || 1,
      events:               events,
      eventResponses,
      rsvpStatus:           this.deriveRsvpStatus(eventResponses),
      notes:                form.querySelector('[name="notes"]')?.value?.trim()
    };

    if (!data.name) { showNotification('Guest name is required', 'error'); return; }
    if (events.length === 0) { showNotification('Select at least one event for this guest', 'error'); return; }

    try {
      await apiCall('/api/guests', 'POST', data);
      showNotification('Guest added!', 'success');
      modal.style.display = 'none';
      await this.loadGuests();
      this.render();
    } catch (err) {
      showNotification('Failed to add guest', 'error');
    }
  },

  openEditGuestModal(guest) {
    const modal = document.querySelector('[data-modal="editGuest"]');
    if (!modal) return;
    this.setupGuestEventChecklist(modal);

    const form = modal.querySelector('form');
    if (form) {
      form.querySelector('[name="name"]').value        = guest.name || '';
      form.querySelector('[name="email"]').value       = guest.email || '';
      form.querySelector('[name="phone"]').value       = guest.phone || '';
      form.querySelector('[name="side"]').value        = this.normalizeGuestSide(guest.side) || '';
      form.querySelector('[name="partySize"]').value   = guest.partySize || 1;
      form.querySelector('[name="rsvpStatus"]').value  = guest.rsvpStatus || 'pending';
      form.querySelector('[name="notes"]').value       = guest.notes || '';
      this.setGuestEventSelections(form, this.getGuestEvents(guest));
      this.renderManualEventResponses(form, guest);
    }

    modal.style.display = 'flex';
    modal.dataset.guestId = guest.id;

    const btn = modal.querySelector('button[type="submit"]');
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.submitEditGuest(modal);
      });
    }
  },

  async submitEditGuest(modal) {
    const guestId = modal.dataset.guestId;
    const form = modal.querySelector('form');
    const events = this.getSelectedGuestEvents(form);
    let eventResponses;
    try {
      eventResponses = this.getManualEventResponses(form);
    } catch (error) {
      showNotification(error.message, 'error');
      return;
    }
    const data = {
      name:                form.querySelector('[name="name"]')?.value?.trim(),
      email:               form.querySelector('[name="email"]')?.value?.trim(),
      phone:               form.querySelector('[name="phone"]')?.value?.trim(),
      side:                form.querySelector('[name="side"]')?.value,
      partySize:           parseInt(form.querySelector('[name="partySize"]')?.value, 10) || 1,
      rsvpStatus:          this.deriveRsvpStatus(eventResponses),
      events:              events,
      eventResponses,
      notes:               form.querySelector('[name="notes"]')?.value?.trim()
    };

    if (events.length === 0) { showNotification('Select at least one event for this guest', 'error'); return; }

    try {
      await apiCall(`/api/guests?id=${guestId}`, 'PUT', data);
      showNotification('Guest updated!', 'success');
      modal.style.display = 'none';
      await this.loadGuests();
      this.render();
    } catch (err) {
      showNotification('Failed to update guest', 'error');
    }
  },

  async deleteGuest(guestId) {
    if (!confirm('Delete this guest?')) return;
    try {
      await apiCall(`/api/guests?id=${guestId}`, 'DELETE');
      showNotification('Guest deleted', 'success');
      await this.loadGuests();
      this.render();
    } catch (err) {
      showNotification('Failed to delete guest', 'error');
    }
  },

  async resetAllGuests() {
    if (!confirm('⚠️ Reset ALL guests? This will permanently delete all guest data.')) return;
    try {
      await apiCall('/api/guests?action=reset', 'DELETE');
      guestModule.guests = [];
      guestModule.filteredGuests = [];
      showNotification('All guests cleared', 'success');
      this.render();
    } catch (err) {
      showNotification('Failed to reset guests', 'error');
    }
  },

  openBulkInviteModal() {
    const modal = document.querySelector('[data-modal="bulkInvite"]');
    if (!modal) return;
    modal.style.display = 'flex';

    // Use cloneNode to clear any stacked listeners
    const btn = modal.querySelector('button[type="submit"]');
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.submitBulkInvite(modal);
      });
    }
  },

  async submitBulkInvite(modal) {
    const form = modal.querySelector('form');
    const filterStatus = form.querySelector('[name="filterStatus"]')?.value || 'all';
    const subject = form.querySelector('[name="subject"]')?.value || `RSVP requested - Akhila & Akshay's Wedding`;
    const message = form.querySelector('[name="message"]')?.value || '';

    try {
      const res = await apiCall('/api/guests?action=bulk-invite', 'POST', { filterStatus, subject, message });
      const hasFailures = !res.success || !res.sendingEnabled || Number(res.failed || 0) > 0;
      const firstErrorItem = res.errors?.[0] || {};
      const failedGuest = [firstErrorItem.name, firstErrorItem.email].filter(Boolean).join(' ');
      const firstErrorText = firstErrorItem.error ? `${failedGuest ? `${failedGuest} - ` : ''}${firstErrorItem.error}` : '';
      const firstError = firstErrorText && firstErrorText !== res.message ? `: ${firstErrorText}` : '';
      const errorAlreadyShown = firstErrorItem.error && res.message?.includes(firstErrorItem.error);
      showNotification((res.message || `Invites prepared for ${res.invitedCount || 0} guests`) + (hasFailures && !errorAlreadyShown ? firstError : ''), hasFailures ? 'error' : 'success');
      modal.style.display = 'none';
      await this.loadGuests();
      this.render();
    } catch (err) {
      showNotification('Failed to prepare invites', 'error');
    }
  },

  async exportGuests() {
    try {
      const response = await fetch('/api/guests?action=export');
      if (!response.ok) throw new Error(`${response.status}`);
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), {
        href: url,
        download: `guests-${new Date().toISOString().split('T')[0]}.csv`
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      showNotification('Failed to export guests', 'error');
    }
  },

  async importGuestFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const guests = this.parseGuestImport(text, file.name);

      if (guests.length === 0) {
        showNotification('No usable guests found in that file', 'error');
        return;
      }

      const confirmed = confirm(`Import ${guests.length} guests from ${file.name}? Existing matches by email, phone, or name will be updated.`);
      if (!confirmed) return;

      const response = await apiCall('/api/guests?action=import', 'POST', { guests });
      showNotification(`Imported ${response.added || 0} new, updated ${response.updated || 0}, skipped ${response.skipped || 0}`, 'success');
      await this.loadGuests();
      this.render();
    } catch (err) {
      console.error('Guest import failed:', err);
      showNotification('Failed to import guest list', 'error');
    }
  },

  parseGuestImport(text, fileName = '') {
    const trimmed = (text || '').trim();
    if (!trimmed) return [];

    const isCsv = /\.csv$/i.test(fileName) || this.looksLikeCsv(trimmed);
    const rows = isCsv ? this.parseCsvRows(trimmed) : this.parseTextRows(trimmed);

    if (rows.length === 0) return [];

    if (isCsv) {
      return this.mapStructuredRows(rows);
    }

    return rows.map(row => this.inferGuestFromParts(row)).filter(g => g.name);
  },

  looksLikeCsv(text) {
    const firstLine = text.split(/\r?\n/).find(line => line.trim()) || '';
    return /[,;\t|]/.test(firstLine);
  },

  parseCsvRows(text) {
    const delimiter = this.detectDelimiter(text);
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && char === delimiter) {
        row.push(cell.trim());
        cell = '';
      } else if (!inQuotes && (char === '\n' || char === '\r')) {
        if (char === '\r' && next === '\n') i++;
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }

    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
  },

  detectDelimiter(text) {
    const firstLine = text.split(/\r?\n/).find(line => line.trim()) || '';
    return [',', '\t', ';', '|']
      .map(delimiter => ({ delimiter, count: firstLine.split(delimiter).length - 1 }))
      .sort((a, b) => b.count - a.count)[0]?.delimiter || ',';
  },

  parseTextRows(text) {
    return text
      .split(/\r?\n/)
      .map(line => line.replace(/^[-*•\d.)\s]+/, '').trim())
      .filter(Boolean)
      .map(line => line.split(/\s*(?:,|;|\||\t| - | – | — )\s*/).filter(Boolean));
  },

  mapStructuredRows(rows) {
    const header = rows[0].map(value => this.normalizeHeader(value));
    const hasHeader = header.some(value => ['name', 'email', 'phone', 'relationship', 'side', 'partySize', 'dietaryRestrictions', 'events', 'notes', 'rsvpStatus'].includes(value));
    const dataRows = hasHeader ? rows.slice(1) : rows;

    return dataRows
      .map(row => hasHeader ? this.guestFromHeaderRow(row, header) : this.inferGuestFromParts(row))
      .filter(g => g.name);
  },

  normalizeHeader(value) {
    const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const map = {
      guest: 'name',
      guestname: 'name',
      fullname: 'name',
      name: 'name',
      email: 'email',
      emailaddress: 'email',
      mail: 'email',
      phone: 'phone',
      phonenumber: 'phone',
      mobile: 'phone',
      contact: 'phone',
      relationship: 'relationship',
      relation: 'relationship',
      side: 'side',
      guestside: 'side',
      weddingside: 'side',
      group: 'relationship',
      familyside: 'side',
      bridegroomside: 'side',
      partysize: 'partySize',
      guests: 'partySize',
      count: 'partySize',
      plusones: 'partySize',
      dietary: 'dietaryRestrictions',
      diet: 'dietaryRestrictions',
      meal: 'dietaryRestrictions',
      food: 'dietaryRestrictions',
      dietaryrestrictions: 'dietaryRestrictions',
      events: 'events',
      event: 'events',
      ceremony: 'events',
      ceremonies: 'events',
      function: 'events',
      functions: 'events',
      invitedevents: 'events',
      eventsinvited: 'events',
      eventsinvitedto: 'events',
      invitedto: 'events',
      invitedfor: 'events',
      rsvp: 'rsvpStatus',
      rsvpstatus: 'rsvpStatus',
      status: 'rsvpStatus',
      notes: 'notes',
      note: 'notes'
    };
    return map[key] || key;
  },

  guestFromHeaderRow(row, header) {
    const data = {};
    header.forEach((field, index) => {
      if (!field) return;
      data[field] = row[index] || '';
    });

    return this.normalizeImportedGuest(data);
  },

  inferGuestFromParts(parts) {
    const cleanParts = parts.map(part => String(part || '').trim()).filter(Boolean);
    const text = cleanParts.join(' ');
    const singleLine = cleanParts.length === 1;
    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
    const phone = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] || '';
    const partyMatch = singleLine
      ? text.match(/\b(?:party|size|count|guests?)\s*[:=]?\s*(\d+)\b/i)
      : null;
    const partySize = partyMatch?.[1]
      || cleanParts.find(part => /^(party\s*)?(size|count)?\s*[:=]?\s*\d+$/i.test(part))?.match(/\d+/)?.[0]
      || cleanParts.find(part => /^\d+$/.test(part));
    let dietary = '';
    if (singleLine) {
      if (/\b(non[-\s]?veg(?:etarian)?|meat|chicken)\b/i.test(text)) dietary = 'non-vegetarian';
      else if (/\bvegan\b/i.test(text)) dietary = 'vegan';
      else if (/\b(vegetarian|veg)\b/i.test(text)) dietary = 'vegetarian';
      else if (/\bgluten[-\s]?free\b/i.test(text)) dietary = 'gluten-free';
      else if (/\b(apane|family)\b/i.test(text)) dietary = 'apane';
      else if (/\b(no dietary|none)\b/i.test(text)) dietary = 'none';
    } else {
      dietary = cleanParts.find(part => /(veg|vegan|non|meat|chicken|gluten|apane|family|none|diet)/i.test(part)) || '';
    }
    const rsvpStatus = cleanParts.find(part => /(accepted|confirmed|pending|declined|maybe|attending|not attending)/i.test(part)) || '';
    const side = this.normalizeGuestSide(text);
    const eventPattern = /\b(satyanarayana(?:\s+swamy)?(?:\s+vratam)?|vratam|pelli\s*koduku|pellikoduku|pelli\s*kuthuru|pellikuthuru|nalugu|marriage|wedding|sangeet|pre-wedding|reception|mehendi|haldi|ceremony|cocktail)\b/gi;
    const eventWords = text.match(eventPattern) || [];
    const extractEvents = value => [...new Set((String(value || '').match(eventPattern) || [])
      .map(eventName => this.normalizeEventName(eventName))
      .filter(Boolean))];
    const events = singleLine
      ? extractEvents(text)
      : cleanParts
        .flatMap(part => extractEvents(part));

    let namePart = cleanParts.find(part =>
      part !== email &&
      part !== phone &&
      part !== partySize &&
      part !== dietary &&
      part !== rsvpStatus &&
      !events.includes(part) &&
      !/@/.test(part) &&
      !/\d{3}/.test(part)
    ) || cleanParts[0] || '';

    if (singleLine) {
      const relationshipWords = text.match(/\b(bride|groom|friend|family|work|college|school|relative|cousin|uncle|aunt)\b/gi) || [];
      const sideWords = text.match(/\b(akhila|akshay|chennaboina|lenkalapally|bride'?s?|groom'?s?)\b/gi) || [];
      const removableWords = [...eventWords, ...relationshipWords, ...sideWords].map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const inferredName = text
        .replace(email, '')
        .replace(phone, '')
        .replace(/\b(?:party|size|count|guests?)\s*[:=]?\s*\d+\b/gi, '')
        .replace(/\b(veg|vegetarian|vegan|non-vegetarian|non vegetarian|nonveg|non veg|gluten-free|gluten free|accepted|confirmed|pending|declined|maybe|attending|no dietary|none)\b/gi, '')
        .replace(removableWords.length ? new RegExp(`\\b(${removableWords.join('|')})\\b`, 'gi') : /$a/, '')
        .replace(/[,:;|()/-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (inferredName) namePart = inferredName;
    }

    const relationship = singleLine
      ? (text.match(/\b(bride|groom|friend|family|work|college|school|relative|cousin|uncle|aunt)\b/i)?.[0] || '')
      : cleanParts.find(part => /(bride|groom|friend|family|work|college|school|relative|cousin|uncle|aunt)/i.test(part) && part !== dietary) || '';
    const notes = singleLine
      ? ''
      : cleanParts.filter(part => ![namePart, email, phone, partySize, dietary, rsvpStatus, relationship, side].includes(part) && !events.includes(part)).join('; ');

    return this.normalizeImportedGuest({ name: namePart, email, phone, relationship, side, partySize, dietaryRestrictions: dietary, events, rsvpStatus, notes });
  },

  normalizeImportedGuest(data) {
    const events = this.normalizeEvents(data.events);

    return {
      name: String(data.name || '').trim(),
      email: String(data.email || '').trim(),
      phone: String(data.phone || '').trim(),
      relationship: String(data.relationship || '').trim(),
      side: this.normalizeGuestSide(data.side),
      partySize: Math.max(1, parseInt(data.partySize, 10) || 1),
      dietaryRestrictions: this.normalizeDietary(data.dietaryRestrictions),
      events: events.map(e => this.normalizeEventName(e)).filter(Boolean),
      rsvpStatus: this.normalizeRsvpStatus(data.rsvpStatus),
      notes: String(data.notes || '').trim()
    };
  },

  normalizeEvents(value) {
    if (Array.isArray(value)) {
      return [...new Set(value.flatMap(item => this.normalizeEvents(item)))];
    }

    const text = String(value || '').trim();
    if (!text) return [];

    if (/^(all|all events|all ceremonies|all functions|all festivities|every event|full)$/i.test(text)) {
      return [...this.guestEventNames];
    }

    const found = this.guestEventAliases
      .filter(({ pattern }) => pattern.test(text))
      .map(({ name }) => name);
    if (found.length > 0) return [...new Set(found)];

    return [...new Set(
      text
        .split(/[|;,+/&\n]/)
        .map(eventName => this.normalizeEventName(eventName))
        .filter(Boolean)
    )];
  },

  normalizeEventName(value) {
    const text = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!text) return '';
    if (text.includes('haldi')) return 'Haldi';
    if (text.includes('sangeet')) return 'Sangeet';
    if (text.includes('pellikoduku') || text.includes('pelli koduku') || text.includes('pellikuthuru') || text.includes('pelli kuthuru') || text.includes('nalugu') || text.includes('mehendi')) return 'Pellikuthuru';
    if (text.includes('satyanarayana') || text.includes('vratam')) return 'Satyanarayana Swamy Vratam';
    if (text.includes('marriage') || text.includes('wedding') || text.includes('ceremony')) return 'Marriage';
    return '';
  },

  normalizeGuestSide(value) {
    const text = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!text) return '';
    if (/\b(akhila|bride|chennaboina|girl|girl's|girls)\b/i.test(text)) return 'akhila';
    if (/\b(akshay|groom|lenkalapally|boy|boy's|boys)\b/i.test(text)) return 'akshay';
    return '';
  },

  displayGuestSide(value) {
    const side = this.normalizeGuestSide(value);
    if (side === 'akhila') return "Akhila's side";
    if (side === 'akshay') return "Akshay's side";
    return '';
  },

  normalizeDietary(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return 'none';
    if (text.includes('non') || text.includes('chicken') || text.includes('meat')) return 'non-vegetarian';
    if (text.includes('vegan')) return 'vegan';
    if (text.includes('veg')) return 'vegetarian';
    if (text.includes('gluten')) return 'gluten-free';
    if (text.includes('apane') || text.includes('family')) return 'apane';
    if (['none', 'no', 'na', 'n/a'].includes(text)) return 'none';
    return 'other';
  },

  normalizeRsvpStatus(value) {
    const text = String(value || '').trim().toLowerCase();
    if (['accepted', 'accept', 'yes', 'attending', 'confirmed'].includes(text)) return 'accepted';
    if (['declined', 'decline', 'no', 'not attending'].includes(text)) return 'declined';
    if (['maybe', 'tentative'].includes(text)) return 'maybe';
    return 'pending';
  }
};

if (typeof window !== 'undefined') window.guestListPage = guestListPage;
