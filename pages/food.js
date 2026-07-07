/**
 * Food & Menu Page Logic
 * Renders menu items by event and meal type
 */

const foodPage = {
  currentFilters: {
    eventType: '',
    courseType: '',
    search: ''
  },

  async init() {
    this.setupEventListeners();
    await this.loadFood();
    this.render();
  },

  setupEventListeners() {
    const foodView = document.querySelector('[data-view="food"]');
    if (!foodView) return;

    const eventTypeFilter = foodView.querySelector('.food-event-type-filter');
    if (eventTypeFilter) {
      eventTypeFilter.addEventListener('change', (e) => {
        this.currentFilters.eventType = e.target.value;
        this.applyFilters();
      });
    }

    const courseTypeFilter = foodView.querySelector('.food-course-type-filter');
    if (courseTypeFilter) {
      courseTypeFilter.addEventListener('change', (e) => {
        this.currentFilters.courseType = e.target.value;
        this.applyFilters();
      });
    }

    const addBtn = foodView.querySelector('.food-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openAddDishModal());
    }

    const importBtn = foodView.querySelector('.food-import-btn');
    const importInput = foodView.querySelector('.food-import-input');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', (e) => this.handleImportFile(e.target.files?.[0], importInput));
    }

    const resetBtn = foodView.querySelector('.food-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetMenuItems());
    }

    const clearFiltersBtn = foodView.querySelector('.food-clear-filters-btn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        this.currentFilters = { eventType: '', courseType: '', search: '' };
        if (eventTypeFilter) eventTypeFilter.value = '';
        if (courseTypeFilter) courseTypeFilter.value = '';
        this.applyFilters();
      });
    }

    const addDishModal = document.querySelector('[data-modal="addDish"]');
    if (addDishModal) {
      const form = addDishModal.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitAddDish(addDishModal);
        });
      }
    }

    const editDishModal = document.querySelector('[data-modal="editDish"]');
    if (editDishModal) {
      const form = editDishModal.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.submitEditDish(editDishModal);
        });
      }
    }
  },

  async loadFood() {
    try {
      await Promise.all([foodModule.fetch(), foodModule.fetchRsvpSummary()]);
    } catch (error) {
      showNotification('Failed to load menu or RSVP catering totals', 'error');
    }
  },

  applyFilters() {
    foodModule.filter(this.currentFilters);
    this.render();
  },

  render() {
    const foodView = document.querySelector('[data-view="food"]');
    if (!foodView) return;
    this.renderStats();
    this.renderCateringSummary();
    this.renderMenuItems();
  },

  renderCateringSummary() {
    const foodView = document.querySelector('[data-view="food"]');
    const container = foodView?.querySelector('.food-catering-summary');
    if (!container) return;
    const events = foodModule.rsvpSummary || [];
    if (!events.length) {
      container.innerHTML = '<p class="empty-state">No RSVP catering responses yet.</p>';
      return;
    }
    container.innerHTML = events.map(event => `
      <article class="card" style="margin:0;border-left:3px solid var(--gold);">
        <h4 style="margin:0 0 .65rem;color:var(--blue);">${this.escapeHtml(event.name)}</h4>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;font-size:.9rem;">
          <span style="color:#278a4b;"><strong>${event.vegetarianMeals || 0}</strong> vegetarian</span>
          <span style="color:#c0392b;"><strong>${event.nonVegetarianMeals || 0}</strong> non-veg</span>
        </div>
      </article>`).join('');
  },

  renderStats() {
    const foodView = document.querySelector('[data-view="food"]');
    const statsContainer = foodView?.querySelector('.food-stats');
    if (!statsContainer) return;

    const summary = foodModule.getSummary();
    statsContainer.innerHTML = `
      <div class="stat-card"><div class="stat-value">${summary.total}</div><div class="stat-label">Menu Items</div></div>
      <div class="stat-card"><div class="stat-value">${summary.byVegType.veg}</div><div class="stat-label">Vegetarian</div></div>
      <div class="stat-card"><div class="stat-value">${summary.byVegType['non-veg']}</div><div class="stat-label">Non-Vegetarian</div></div>
      <div class="stat-card"><div class="stat-value">$${(summary.totalCost||0).toLocaleString('en-US',{maximumFractionDigits:0})}</div><div class="stat-label">Total Cost <span style="font-size:0.7rem;color:#888;">≈ ₹${(((summary.totalCost||0)*83)/100000).toFixed(1)}L</span></div></div>
    `;
  },

  renderMenuItems() {
    const foodView = document.querySelector('[data-view="food"]');
    const menuContainer = foodView?.querySelector('.food-list-container');
    if (!menuContainer) return;

    if (foodModule.filteredItems.length === 0) {
      menuContainer.innerHTML = '<p class="empty-state">No menu items found.</p>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'food-event-list';

    const itemMap = new Map(foodModule.filteredItems.map(item => [String(item.id), item]));
    const groupedItems = this.groupMenuItemsByEvent(foodModule.filteredItems);

    groupedItems.forEach(([eventName, items]) => {
      const section = document.createElement('section');
      section.className = 'food-event-section';
      const vegetarianCount = items.filter(item => item.vegNonVeg === 'veg').length;
      const nonVegetarianCount = items.filter(item => item.vegNonVeg === 'non-veg').length;
      const sharedCount = items.filter(item => !['veg', 'non-veg'].includes(item.vegNonVeg)).length;

      section.innerHTML = `
        <div class="food-event-heading">
          <div>
            <span class="food-event-kicker">Event-wise menu</span>
            <h3>${this.escapeHtml(eventName)} Menu</h3>
            <p class="food-event-subtitle">${items.length} dish${items.length === 1 ? '' : 'es'} listed below for this event</p>
          </div>
          <div class="food-event-counts">
            <span>${items.length} dish${items.length === 1 ? '' : 'es'}</span>
            <span>${vegetarianCount} veg</span>
            <span>${nonVegetarianCount} non-veg</span>
            ${sharedCount ? `<span>${sharedCount} shared</span>` : ''}
          </div>
        </div>
        <div class="table-container food-menu-table-wrap">
          <table class="food-menu-table">
            <thead>
              <tr>
                <th>Dish</th>
                <th>Meal</th>
                <th>Type</th>
                <th>Cuisine</th>
                <th>Cost</th>
                <th>Portion</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => {
                const vegTypeLabel = item.vegNonVeg === 'veg' ? 'Vegetarian' : item.vegNonVeg === 'non-veg' ? 'Non-Vegetarian' : 'Shared';
                const vegTypeClass = item.vegNonVeg === 'veg' ? 'food-type-veg' : item.vegNonVeg === 'non-veg' ? 'food-type-non-veg' : 'food-type-shared';
                return `
                  <tr>
                    <td>
                      <strong class="food-dish-name">${this.escapeHtml(item.dish)}</strong>
                      ${item.guestAccommodations?.length ? `<span class="food-accommodation-note">${item.guestAccommodations.length} guest accommodation(s)</span>` : ''}
                    </td>
                    <td><span class="food-course-pill">${this.escapeHtml(this.titleCase(item.courseType))}</span></td>
                    <td><span class="food-type-pill ${vegTypeClass}">${vegTypeLabel}</span></td>
                    <td>${this.escapeHtml(item.cuisine || 'Cuisine TBD')}</td>
                    <td>$${(item.cost || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                    <td>${this.escapeHtml(item.portionSize || '1 plate')}</td>
                    <td>
                      <div class="food-row-actions">
                        <button class="btn-icon edit-dish" data-id="${this.escapeHtml(item.id)}" title="Edit">✎</button>
                        <button class="btn-icon delete-dish" data-id="${this.escapeHtml(item.id)}" title="Delete">✕</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      section.querySelectorAll('.edit-dish').forEach(button => {
        button.addEventListener('click', () => {
          const item = itemMap.get(String(button.dataset.id));
          if (item) this.openEditDishModal(item);
        });
      });

      section.querySelectorAll('.delete-dish').forEach(button => {
        button.addEventListener('click', () => {
          const item = itemMap.get(String(button.dataset.id));
          if (item && confirm(`Delete "${item.dish}"?`)) this.deleteDish(item.id);
        });
      });

      list.appendChild(section);
    });

    menuContainer.innerHTML = '';
    menuContainer.appendChild(list);
  },

  groupMenuItemsByEvent(items) {
    const eventOrder = ['Haldi', 'Sangeet', 'Pellikuthuru', 'Marriage', 'Satyanarayana Swamy Vratam'];
    const courseOrder = ['breakfast', 'lunch', 'dinner', 'snacks', 'mains', 'appetizers', 'sides', 'desserts', 'beverages'];
    const groups = new Map();

    items.forEach(item => {
      const eventName = item.eventType || 'Unassigned Event';
      if (!groups.has(eventName)) groups.set(eventName, []);
      groups.get(eventName).push(item);
    });

    return Array.from(groups.entries())
      .sort(([eventA], [eventB]) => {
        const indexA = eventOrder.indexOf(eventA);
        const indexB = eventOrder.indexOf(eventB);
        if (indexA !== -1 || indexB !== -1) {
          return (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA) - (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB);
        }
        return eventA.localeCompare(eventB);
      })
      .map(([eventName, eventItems]) => [
        eventName,
        eventItems.slice().sort((itemA, itemB) => {
          const courseA = courseOrder.indexOf(itemA.courseType);
          const courseB = courseOrder.indexOf(itemB.courseType);
          if (courseA !== courseB) {
            return (courseA === -1 ? Number.MAX_SAFE_INTEGER : courseA) - (courseB === -1 ? Number.MAX_SAFE_INTEGER : courseB);
          }
          return String(itemA.dish || '').localeCompare(String(itemB.dish || ''));
        })
      ]);
  },

  escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  },

  titleCase(value) {
    return String(value || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  },

  async handleImportFile(file, input) {
    if (!file) return;
    this.showImportStatus(`Reading ${file.name}...`, 'info');
    try {
      const rows = await this.readMenuRows(file);
      const items = this.parseRowsToMenuItems(rows);
      if (!items.length) {
        this.showImportStatus('No dishes could be found. Try including dish names separated by rows, commas, tabs, or columns.', 'error');
        return;
      }

      this.showImportStatus(`Found ${items.length} dish${items.length === 1 ? '' : 'es'}. Importing...`, 'info');
      const result = await foodModule.importMenuItems(items);
      await this.loadFood();
      this.applyFilters();
      const skippedText = result.skippedCount ? ` ${result.skippedCount} duplicate or incomplete row${result.skippedCount === 1 ? '' : 's'} skipped.` : '';
      this.showImportStatus(`Imported ${result.imported || 0} dish${(result.imported || 0) === 1 ? '' : 'es'}.${skippedText}`, 'success');
      showNotification(`Imported ${result.imported || 0} menu item${(result.imported || 0) === 1 ? '' : 's'}`, 'success');
    } catch (error) {
      this.showImportStatus(error.message || 'Failed to import menu file', 'error');
      showNotification(error.message || 'Failed to import menu file', 'error');
    } finally {
      if (input) input.value = '';
    }
  },

  showImportStatus(message, type = 'info') {
    const foodView = document.querySelector('[data-view="food"]');
    const status = foodView?.querySelector('.food-import-status');
    if (!status) return;
    const palette = {
      success: { bg: 'rgba(39, 174, 96, 0.1)', border: '#27ae60', color: '#1e6f42' },
      error: { bg: 'rgba(192, 57, 43, 0.1)', border: '#c0392b', color: '#8e2b20' },
      info: { bg: 'rgba(184, 134, 11, 0.1)', border: 'var(--gold)', color: 'var(--blue)' }
    }[type] || {};
    status.style.cssText = `display:block;margin-bottom:1.25rem;padding:0.85rem 1rem;border-left:3px solid ${palette.border};background:${palette.bg};color:${palette.color};border-radius:0.35rem;`;
    status.textContent = message;
  },

  async readMenuRows(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (['xlsx', 'xls'].includes(extension)) {
      if (!window.XLSX) throw new Error('Excel parser is still loading. Please try again in a moment.');
      const workbook = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
      return workbook.SheetNames.flatMap(sheetName => {
        const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '' });
        return rows.map(cells => ({ sheetName, cells }));
      });
    }

    const text = await file.text();
    return this.rowsFromText(text, file.name);
  },

  rowsFromText(text, fileName = '') {
    const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const delimiter = this.detectDelimiter(lines);
    return lines.map(line => ({
      sheetName: fileName,
      cells: delimiter ? this.parseDelimitedLine(line, delimiter) : [line]
    }));
  },

  detectDelimiter(lines) {
    const candidates = ['\t', ',', '|', ';'];
    let best = '';
    let bestScore = 0;
    candidates.forEach(delimiter => {
      const counts = lines.slice(0, 20).map(line => this.parseDelimitedLine(line, delimiter).length);
      const multi = counts.filter(count => count > 1);
      const score = multi.length ? multi.reduce((sum, count) => sum + count, 0) / multi.length + multi.length : 0;
      if (score > bestScore) {
        best = delimiter;
        bestScore = score;
      }
    });
    return bestScore >= 3 ? best : '';
  },

  parseDelimitedLine(line, delimiter) {
    const cells = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && next === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  },

  parseRowsToMenuItems(rows) {
    const context = {
      eventType: this.currentFilters.eventType || 'Marriage',
      courseType: this.currentFilters.courseType || 'lunch'
    };
    let headerMap = null;
    let activeSheet = '';
    const seen = new Set();
    const items = [];

    rows.forEach(row => {
      const sheetName = row.sheetName || '';
      if (sheetName !== activeSheet) {
        activeSheet = sheetName;
        headerMap = null;
      }
      const cells = (row.cells || []).map(cell => this.cleanCell(cell)).filter(Boolean);
      if (!cells.length) return;

      const sheetEvent = this.findEvent(sheetName);
      const sheetCourse = this.findCourse(sheetName);
      const rowContext = {
        eventType: sheetEvent || context.eventType,
        courseType: sheetCourse || context.courseType
      };

      if (this.isHeaderRow(cells)) {
        headerMap = this.buildHeaderMap(cells);
        return;
      }

      if (cells.length === 1) {
        const eventOnly = this.findEvent(cells[0]);
        const courseOnly = this.findCourse(cells[0]);
        const normalized = cells[0].toLowerCase().replace(/[^a-z]/g, '');
        if (eventOnly && normalized === eventOnly.toLowerCase().replace(/[^a-z]/g, '')) {
          context.eventType = eventOnly;
          return;
        }
        if (courseOnly && normalized === courseOnly.toLowerCase().replace(/[^a-z]/g, '')) {
          context.courseType = courseOnly;
          return;
        }
      }

      const parsed = headerMap
        ? this.itemFromHeader(cells, headerMap, rowContext)
        : this.itemsFromInferredRow(cells, rowContext);

      (Array.isArray(parsed) ? parsed : [parsed]).filter(Boolean).forEach(item => {
        const key = [item.eventType, item.courseType, item.dish].map(value => String(value || '').toLowerCase()).join('|');
        if (!seen.has(key)) {
          seen.add(key);
          items.push(item);
        }
      });
    });

    return items.slice(0, 500);
  },

  isHeaderRow(cells) {
    const headerWords = ['dish', 'item', 'menu', 'event', 'course', 'veg', 'vegetarian', 'cost', 'price', 'portion', 'vendor', 'cuisine', 'notes'];
    return cells.filter(cell => headerWords.some(word => cell.toLowerCase().includes(word))).length >= 2;
  },

  buildHeaderMap(cells) {
    const aliases = {
      dish: ['dish', 'item', 'menu', 'food', 'name'],
      eventType: ['event', 'function', 'ceremony'],
      courseType: ['meal', 'course', 'category', 'type'],
      vegNonVeg: ['veg', 'vegetarian', 'non veg', 'non-veg', 'diet'],
      cost: ['cost', 'price', 'rate', 'amount'],
      portionSize: ['portion', 'serving', 'size', 'qty', 'quantity'],
      preparedBy: ['prepared', 'vendor', 'caterer', 'by'],
      cuisine: ['cuisine', 'style'],
      notes: ['note', 'notes', 'comment', 'comments']
    };
    return Object.fromEntries(Object.entries(aliases).map(([field, options]) => [
      field,
      cells.findIndex(cell => options.some(option => cell.toLowerCase().includes(option)))
    ]));
  },

  itemFromHeader(cells, headerMap, context) {
    const get = field => headerMap[field] >= 0 ? cells[headerMap[field]] : '';
    return this.toMenuItem({
      dish: get('dish') || cells.find(cell => !this.findEvent(cell) && !this.findCourse(cell)),
      eventType: this.findEvent(get('eventType')) || context.eventType,
      courseType: this.findCourse(get('courseType')) || context.courseType,
      vegNonVeg: this.findVegType(get('vegNonVeg')),
      cost: this.findCost(get('cost')),
      portionSize: get('portionSize') || '1 plate',
      preparedBy: get('preparedBy'),
      cuisine: this.findCuisine(get('cuisine')) || get('cuisine') || 'Indian',
      notes: get('notes')
    });
  },

  itemsFromInferredRow(cells, context) {
    if (cells.length === 1) return this.itemsFromFreeformLine(cells[0], context);

    const looseCells = cells.flatMap(cell => cell.split(/\s+(?:-|–|—|•)\s+/).map(part => part.trim()).filter(Boolean));
    if (looseCells.length > cells.length) return this.itemsFromInferredRow(looseCells, context);

    const classified = new Set();
    const eventType = cells.map(cell => this.findEvent(cell)).find(Boolean) || context.eventType;
    const courseType = cells.map(cell => this.findCourse(cell)).find(Boolean) || context.courseType;
    const vegNonVeg = cells.map(cell => this.findVegType(cell)).find(Boolean) || 'both';
    const cuisine = cells.map(cell => this.findCuisine(cell)).find(Boolean) || 'Indian';
    const costCell = cells.find(cell => this.looksLikeCost(cell) && !this.looksLikePortion(cell));
    const portionCell = cells.find(cell => this.looksLikePortion(cell));

    cells.forEach((cell, index) => {
      if (this.findEvent(cell) || this.findCourse(cell) || this.isVegTypeCell(cell) || this.findCuisine(cell) || cell === costCell || cell === portionCell) classified.add(index);
    });

    const unknown = cells.filter((_, index) => !classified.has(index));
    if (!classified.size && cells.length > 1) {
      return cells.map(dish => this.toMenuItem({ dish, eventType, courseType, vegNonVeg, cuisine }));
    }

    const dish = unknown[0] || cells.find(cell => !this.looksLikeCost(cell)) || '';
    const notes = unknown.slice(1).join(' | ');
    return this.toMenuItem({
      dish,
      eventType,
      courseType,
      vegNonVeg,
      cost: this.findCost(costCell),
      portionSize: portionCell || '1 plate',
      cuisine,
      notes
    });
  },

  itemsFromFreeformLine(line, context) {
    const split = line.split(/\s+(?:-|–|—|•)\s+|[|;]/).map(part => part.trim()).filter(Boolean);
    if (split.length > 1) return this.itemsFromInferredRow(split, context);

    const eventType = this.findEvent(line) || context.eventType;
    const courseType = this.findCourse(line) || context.courseType;
    const vegNonVeg = this.findVegType(line) || 'both';
    const cuisine = this.findCuisine(line) || 'Indian';
    const cost = this.findCost(line);
    const afterColon = line.includes(':') ? line.split(':').slice(1).join(':') : line;
    const cleaned = afterColon
      .replace(/\$?\s*\d+(?:\.\d+)?/g, ' ')
      .replace(/\b(haldi|sangeeth?|pellikuthuru|pellikoduku|nalugu|marriage|wedding|muhurtham|satyanarayana|vratam|pooja|puja)\b/ig, ' ')
      .replace(/\b(appetizers?|starters?|mains?|entrees?|curr(?:y|ies)|sides?|desserts?|sweets?|beverages?|drinks?|snacks?|breakfast|lunch|dinner|brunch|supper)\b/ig, ' ')
      .replace(/\b(veg|vegetarian|non[-\s]?veg|non[-\s]?vegetarian|both|shared)\b/ig, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const dishes = this.splitDishList(cleaned);
    return dishes.map(dish => this.toMenuItem({ dish, eventType, courseType, vegNonVeg, cost, cuisine }));
  },

  splitDishList(value) {
    const parts = String(value || '').split(/[,/]+/).map(part => part.trim()).filter(Boolean);
    return parts.length > 1 && parts.every(part => part.length <= 60) ? parts : [String(value || '').trim()].filter(Boolean);
  },

  toMenuItem(data) {
    const dish = this.cleanDishName(data.dish);
    if (!dish) return null;
    return {
      dish,
      eventType: data.eventType || this.currentFilters.eventType || 'Marriage',
      courseType: data.courseType || this.currentFilters.courseType || 'lunch',
      vegNonVeg: data.vegNonVeg || 'both',
      cost: Number.isFinite(data.cost) ? data.cost : 0,
      portionSize: data.portionSize || '1 plate',
      preparedBy: data.preparedBy || '',
      cuisine: data.cuisine || 'Indian',
      notes: data.notes || ''
    };
  },

  cleanCell(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  },

  cleanDishName(value) {
    return this.cleanCell(value)
      .replace(/^(dish|item|menu item)\s*[:=-]\s*/i, '')
      .replace(/\s+\$?\d+(?:\.\d+)?$/g, '')
      .trim();
  },

  findEvent(value) {
    const text = this.cleanCell(value).toLowerCase();
    if (!text) return '';
    if (/\bhaldi\b/.test(text)) return 'Haldi';
    if (/\bsangeeth?\b/.test(text)) return 'Sangeet';
    if (/\b(pellikuthuru|pelli kuthuru|pellikoduku|pelli koduku|nalugu)\b/.test(text)) return 'Pellikuthuru';
    if (/\b(satyanarayana|vratam|pooja|puja)\b/.test(text)) return 'Satyanarayana Swamy Vratam';
    if (/\b(marriage|wedding|muhurtham|ceremony)\b/.test(text)) return 'Marriage';
    return '';
  },

  findCourse(value) {
    const text = this.cleanCell(value).toLowerCase();
    if (/\b(breakfast|brunch|morning|snacks?)\b/.test(text)) return 'breakfast';
    if (/\b(dinner|supper|evening)\b/.test(text)) return 'dinner';
    if (/\b(lunch|noon|afternoon|mains?|entrees?|curr(?:y|ies)|appetizers?|starters?|sides?|desserts?|sweets?|beverages?|drinks?)\b/.test(text)) return 'lunch';
    return '';
  },

  findVegType(value) {
    const text = this.cleanCell(value).toLowerCase();
    if (/\b(non[-\s]?veg|non[-\s]?vegetarian|chicken|fish|meat|egg|nv)\b/.test(text)) return 'non-veg';
    if (/\b(veg|vegetarian|pure veg|v)\b/.test(text)) return 'veg';
    if (/\b(both|shared|all)\b/.test(text)) return 'both';
    return '';
  },

  isVegTypeCell(value) {
    const text = this.cleanCell(value).toLowerCase().replace(/[^a-z]/g, '');
    return ['veg', 'vegetarian', 'pureveg', 'v', 'nonveg', 'nonvegetarian', 'nv', 'both', 'shared', 'all'].includes(text);
  },

  findCuisine(value) {
    const text = this.cleanCell(value).toLowerCase();
    if (/\b(indian|telugu|south indian|north indian)\b/.test(text)) return 'Indian';
    if (/\b(fusion)\b/.test(text)) return 'Fusion';
    if (/\b(continental|american|western)\b/.test(text)) return 'Continental';
    if (/\b(chinese|indo chinese)\b/.test(text)) return 'Chinese';
    if (/\b(italian)\b/.test(text)) return 'Italian';
    return '';
  },

  looksLikeCost(value) {
    return /(?:^|[^\w])[$₹]?\s*\d+(?:\.\d+)?\s*(?:usd|rs|inr|\/|per)?/i.test(this.cleanCell(value));
  },

  findCost(value) {
    const match = this.cleanCell(value).match(/[$₹]?\s*(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) || 0 : 0;
  },

  looksLikePortion(value) {
    return /\b(plate|serving|person|people|pax|piece|pcs|qty|quantity|portion|bowl|glass|cup)\b/i.test(this.cleanCell(value));
  },

  openAddDishModal() {
    const modal = document.querySelector('[data-modal="addDish"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) form.reset();
      modal.style.display = 'flex';
    }
  },

  async submitAddDish(modal) {
    const form = modal.querySelector('form');
    const data = {
      eventType: form.querySelector('[name="eventType"]')?.value,
      courseType: form.querySelector('[name="courseType"]')?.value,
      dish: form.querySelector('[name="dish"]')?.value,
      vegNonVeg: form.querySelector('[name="vegNonVeg"]')?.value || 'both',
      cost: parseFloat(form.querySelector('[name="cost"]')?.value) || 0,
      portionSize: form.querySelector('[name="portionSize"]')?.value || '1 plate',
      preparedBy: form.querySelector('[name="preparedBy"]')?.value,
      cuisine: form.querySelector('[name="cuisine"]')?.value,
      notes: form.querySelector('[name="notes"]')?.value
    };

    if (!data.dish || !data.eventType || !data.courseType) { showNotification('Dish, event, and meal type required', 'error'); return; }

    try {
      await foodModule.addMenuItem(data);
      showNotification('Dish added', 'success');
      modal.style.display = 'none';
      await this.loadFood();
      this.render();
    } catch (error) {
      showNotification('Failed to add dish', 'error');
    }
  },

  openEditDishModal(item) {
    const modal = document.querySelector('[data-modal="editDish"]');
    if (modal) {
      const form = modal.querySelector('form');
      if (form) {
        form.querySelector('[name="dish"]').value = item.dish;
        form.querySelector('[name="eventType"]').value = item.eventType;
        form.querySelector('[name="courseType"]').value = item.courseType;
        form.querySelector('[name="vegNonVeg"]').value = item.vegNonVeg;
        form.querySelector('[name="cost"]').value = item.cost || '';
        form.querySelector('[name="portionSize"]').value = item.portionSize || '';
        form.querySelector('[name="preparedBy"]').value = item.preparedBy || '';
        form.querySelector('[name="cuisine"]').value = item.cuisine || '';
        form.querySelector('[name="notes"]').value = item.notes || '';
      }
      modal.dataset.dishId = item.id;
      modal.style.display = 'flex';
    }
  },

  async submitEditDish(modal) {
    const dishId = modal.dataset.dishId;
    const form = modal.querySelector('form');
    const data = {
      dish: form.querySelector('[name="dish"]')?.value,
      eventType: form.querySelector('[name="eventType"]')?.value,
      courseType: form.querySelector('[name="courseType"]')?.value,
      vegNonVeg: form.querySelector('[name="vegNonVeg"]')?.value,
      cost: parseFloat(form.querySelector('[name="cost"]')?.value) || 0,
      portionSize: form.querySelector('[name="portionSize"]')?.value,
      preparedBy: form.querySelector('[name="preparedBy"]')?.value,
      cuisine: form.querySelector('[name="cuisine"]')?.value,
      notes: form.querySelector('[name="notes"]')?.value
    };

    try {
      await foodModule.updateMenuItem(dishId, data);
      showNotification('Dish updated', 'success');
      modal.style.display = 'none';
      await this.loadFood();
      this.render();
    } catch (error) {
      showNotification('Failed to update dish', 'error');
    }
  },

  async deleteDish(dishId) {
    try {
      await foodModule.deleteMenuItem(dishId);
      showNotification('Dish deleted', 'success');
      await this.loadFood();
      this.render();
    } catch (error) {
      showNotification('Failed to delete dish', 'error');
    }
  },

  async resetMenuItems() {
    const total = foodModule.menuItems.length;
    const message = total
      ? `Reset the full food menu and delete all ${total} dish${total === 1 ? '' : 'es'}?`
      : 'Reset the food menu?';
    if (!confirm(message)) return;

    try {
      await foodModule.resetMenuItems();
      this.currentFilters = { eventType: '', courseType: '', search: '' };
      const foodView = document.querySelector('[data-view="food"]');
      const eventTypeFilter = foodView?.querySelector('.food-event-type-filter');
      const courseTypeFilter = foodView?.querySelector('.food-course-type-filter');
      if (eventTypeFilter) eventTypeFilter.value = '';
      if (courseTypeFilter) courseTypeFilter.value = '';
      this.showImportStatus('Menu reset. You can import a fresh file or add dishes manually.', 'success');
      showNotification('Menu reset', 'success');
      await this.loadFood();
      this.render();
    } catch (error) {
      showNotification('Failed to reset menu', 'error');
    }
  }
};

if (typeof window !== 'undefined') {
  window.foodPage = foodPage;
}
