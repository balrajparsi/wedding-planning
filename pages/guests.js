/**
 * Guest List Page Logic
 */

const guestListPage = {
  listenersSetup: false, // prevents stacking listeners on repeated navigation

  currentFilters: {
    rsvpStatus: '',
    search: '',
    dietary: '',
    sortBy: 'name',
    sortDir: 'asc'
  },

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

    // Dietary filter
    view.querySelector('.guest-dietary-filter')?.addEventListener('change', (e) => {
      this.currentFilters.dietary = e.target.value;
      this.applyFilters();
    });

    // Clear filters
    view.querySelector('.guest-clear-btn')?.addEventListener('click', () => {
      this.currentFilters = { rsvpStatus: '', search: '', dietary: '', sortBy: 'name', sortDir: 'asc' };
      view.querySelector('.guest-search').value = '';
      view.querySelector('.guest-rsvp-filter').value = '';
      view.querySelector('.guest-dietary-filter').value = '';
      guestModule.filteredGuests = [...guestModule.guests];
      this.render();
    });

    // Add guest
    view.querySelector('.guest-add-btn')?.addEventListener('click', () => this.openAddGuestModal());

    // Export CSV
    view.querySelector('.guest-export-btn')?.addEventListener('click', () => this.exportGuests());

    // Bulk invite
    view.querySelector('.guest-bulk-invite-btn')?.addEventListener('click', () => this.openBulkInviteModal());

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
      // Always sync filteredGuests after a fresh fetch
      guestModule.filteredGuests = [...guestModule.guests];
    } catch (error) {
      showNotification('Failed to load guests', 'error');
      guestModule.guests = [];
      guestModule.filteredGuests = [];
    }
  },

  applyFilters() {
    guestModule.filter(this.currentFilters);
    this.render();
  },

  render() {
    this.renderStats();
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
    const partySize   = g.reduce((s, x) => s + (parseInt(x.partySize) || 1), 0);
    const veg         = g.filter(x => x.dietaryRestrictions === 'vegetarian' || x.dietaryRestrictions === 'vegan').length;
    const nonVeg      = g.filter(x => x.dietaryRestrictions === 'non-vegetarian').length;
    const apane       = g.filter(x => x.dietaryRestrictions === 'apane').length;

    container.innerHTML = `
      <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total Guests</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#27ae60">${accepted}</div><div class="stat-label">Accepted</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#f39c12">${pending}</div><div class="stat-label">Pending</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#c0392b">${declined}</div><div class="stat-label">Declined</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#2a5f7f">${partySize}</div><div class="stat-label">Total Party Size</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#27ae60">${veg}</div><div class="stat-label">Vegetarian</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#e74c3c">${nonVeg}</div><div class="stat-label">Non-Vegetarian</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#8e44ad">${apane}</div><div class="stat-label">Apane (Family)</div></div>
    `;
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
      const dietaryIcon = '';
      const eventTags = this.renderEventTags(g);
      return `
      <tr>
        <td><strong>${g.name || '—'}</strong></td>
        <td>${g.email || '—'}</td>
        <td>${g.phone || '—'}</td>
        <td>${g.relationship || '—'}</td>
        <td>${this.displayGuestSide(g.side) || '—'}</td>
        <td style="text-align:center">${g.partySize || 1}</td>
        <td>${dietaryIcon} ${g.dietaryRestrictions || 'None'}</td>
        <td>${eventTags || '<span style="color:#aaa;font-size:0.8rem;">—</span>'}</td>
        <td><span class="badge badge-${g.rsvpStatus}">${g.rsvpStatus}</span></td>
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
            <th>Relationship</th>
            <th>Side</th>
            <th>Party Size</th>
            <th>Dietary</th>
            <th>Events</th>
            <th style="cursor:pointer" onclick="guestListPage.sortBy('rsvpStatus')">RSVP ↕</th>
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

  /* ── MODALS ── */
  openAddGuestModal() {
    const modal = document.querySelector('[data-modal="addGuest"]');
    if (!modal) return;
    this.setupGuestEventChecklist(modal);
    const form = modal.querySelector('form');
    form?.reset();
    if (form) this.setGuestEventSelections(form, this.guestEventNames);
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
    const data = {
      name:                 form.querySelector('[name="name"]')?.value?.trim(),
      email:                form.querySelector('[name="email"]')?.value?.trim(),
      phone:                form.querySelector('[name="phone"]')?.value?.trim(),
      relationship:         form.querySelector('[name="relationship"]')?.value?.trim(),
      side:                 form.querySelector('[name="side"]')?.value,
      partySize:            parseInt(form.querySelector('[name="partySize"]')?.value) || 1,
      dietaryRestrictions:  form.querySelector('[name="dietary"]')?.value,
      events:               events,
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
      form.querySelector('[name="relationship"]').value= guest.relationship || '';
      form.querySelector('[name="side"]').value        = this.normalizeGuestSide(guest.side) || '';
      form.querySelector('[name="partySize"]').value   = guest.partySize || 1;
      form.querySelector('[name="dietary"]').value     = guest.dietaryRestrictions || 'none';
      form.querySelector('[name="rsvpStatus"]').value  = guest.rsvpStatus || 'pending';
      form.querySelector('[name="notes"]').value       = guest.notes || '';
      this.setGuestEventSelections(form, this.getGuestEvents(guest));
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
    const data = {
      name:                form.querySelector('[name="name"]')?.value?.trim(),
      email:               form.querySelector('[name="email"]')?.value?.trim(),
      phone:               form.querySelector('[name="phone"]')?.value?.trim(),
      relationship:        form.querySelector('[name="relationship"]')?.value?.trim(),
      side:                form.querySelector('[name="side"]')?.value,
      partySize:           parseInt(form.querySelector('[name="partySize"]')?.value) || 1,
      dietaryRestrictions: form.querySelector('[name="dietary"]')?.value,
      rsvpStatus:          form.querySelector('[name="rsvpStatus"]')?.value,
      events:              events,
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
      const failedCompletely = !res.success || !res.sendingEnabled || (res.failed && !res.sent);
      const firstErrorText = res.errors?.[0]?.error || '';
      const firstError = firstErrorText && firstErrorText !== res.message ? `: ${firstErrorText}` : '';
      showNotification((res.message || `Invites prepared for ${res.invitedCount || 0} guests`) + (failedCompletely ? firstError : ''), failedCompletely ? 'error' : 'success');
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
