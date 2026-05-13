/**
 * Budget Tracking API — No Auth
 * GET  /api/budget?action=summary  - Budget summary
 * GET  /api/budget?action=items    - List expenses
 * POST /api/budget?action=items    - Add expense
 * PUT  /api/budget?action=items&id=:id  - Update expense
 * DELETE /api/budget?action=items&id=:id - Delete expense
 * GET  /api/budget?action=export   - Export CSV
 */

const crypto = require('crypto');
const kv     = require('../lib/kv');

const WEDDING_ID  = 'akhila-akshay-2026';
const BUDGET_KEY  = `wedding:${WEDDING_ID}:budget`;
const CATEGORIES  = ['venue','catering','photography','florist','music','decor','attire','rings','invitations','transportation','misc'];

module.exports = async function handler(req, res) {
  try {
    const url    = new URL(req.url, 'http://localhost');
    const action = url.searchParams.get('action') || 'items';
    const id     = url.searchParams.get('id') || '';

    if (req.method === 'GET'    && action === 'summary') return handleGetSummary(res);
    if (req.method === 'GET'    && action === 'export')  return handleExport(res);
    if (req.method === 'GET')                            return handleListItems(req, res);
    if (req.method === 'POST')                           return handleAddItem(req, res);
    if (req.method === 'PUT'    && id)                   return handleUpdateItem(id, req, res);
    if (req.method === 'DELETE' && id)                   return handleDeleteItem(id, res);

    res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Budget API error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

async function handleGetSummary(res) {
  const items = (await kv.get(BUDGET_KEY)) || [];

  const summary = { totalBudgeted: 0, totalActual: 0, totalRemaining: 0, byCategory: {} };

  CATEGORIES.forEach(cat => {
    const catItems = items.filter(i => i.category === cat);
    const budgeted = catItems.reduce((s, i) => s + (i.budgeted || 0), 0);
    const actual   = catItems.reduce((s, i) => s + (i.actual   || 0), 0);
    summary.byCategory[cat] = { budgeted, actual, count: catItems.length };
    summary.totalBudgeted  += budgeted;
    summary.totalActual    += actual;
  });

  summary.totalRemaining = summary.totalBudgeted - summary.totalActual;
  res.json(summary);
}

async function handleListItems(req, res) {
  const items = (await kv.get(BUDGET_KEY)) || [];
  const url   = new URL(req.url, 'http://localhost');
  const cat   = url.searchParams.get('category');
  const stat  = url.searchParams.get('status');

  let filtered = items;
  if (cat  && cat  !== 'all') filtered = filtered.filter(i => i.category === cat);
  if (stat && stat !== 'all') filtered = filtered.filter(i => i.status   === stat);

  res.json({ items: filtered, total: items.length });
}

async function handleAddItem(req, res) {
  const { description, category, budgeted, actual, status, vendor, dueDate, notes } = req.body || {};

  if (!description || !category) {
    return res.status(400).json({ error: 'Description and category required' });
  }

  const item = {
    id:          crypto.randomBytes(8).toString('hex'),
    weddingId:   WEDDING_ID,
    description,
    category,
    budgeted:    parseFloat(budgeted) || 0,
    actual:      parseFloat(actual)   || 0,
    status:      status   || 'pending',
    vendor:      vendor   || '',
    dueDate:     dueDate  || '',
    notes:       notes    || '',
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString()
  };

  const items = (await kv.get(BUDGET_KEY)) || [];
  items.push(item);
  await kv.set(BUDGET_KEY, items);
  res.status(201).json(item);
}

async function handleUpdateItem(id, req, res) {
  const items     = (await kv.get(BUDGET_KEY)) || [];
  const idx       = items.findIndex(i => i.id === id);

  if (idx === -1) return res.status(404).json({ error: 'Expense not found' });

  const item = items[idx];
  const body = req.body || {};

  if (body.description !== undefined) item.description = body.description;
  if (body.category    !== undefined) item.category    = body.category;
  if (body.budgeted    !== undefined) item.budgeted    = parseFloat(body.budgeted);
  if (body.actual      !== undefined) item.actual      = parseFloat(body.actual);
  if (body.status      !== undefined) item.status      = body.status;
  if (body.vendor      !== undefined) item.vendor      = body.vendor;
  if (body.dueDate     !== undefined) item.dueDate     = body.dueDate;
  if (body.notes       !== undefined) item.notes       = body.notes;
  item.updatedAt = new Date().toISOString();

  items[idx] = item;
  await kv.set(BUDGET_KEY, items);
  res.json(item);
}

async function handleDeleteItem(id, res) {
  const items    = (await kv.get(BUDGET_KEY)) || [];
  const filtered = items.filter(i => i.id !== id);

  if (filtered.length === items.length) return res.status(404).json({ error: 'Expense not found' });

  await kv.set(BUDGET_KEY, filtered);
  res.json({ success: true });
}

async function handleExport(res) {
  const items = (await kv.get(BUDGET_KEY)) || [];

  const rows = [
    ['Description','Category','Budgeted','Actual','Status','Vendor','Due Date','Notes'].join(','),
    ...items.map(i => [
      `"${i.description}"`, i.category,
      i.budgeted || 0, i.actual || 0, i.status,
      `"${i.vendor || ''}"`, i.dueDate || '', `"${i.notes || ''}"`
    ].join(','))
  ];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="budget.csv"');
  res.send(rows.join('\n'));
}
