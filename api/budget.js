/**
 * Budget Tracking API Endpoints
 * GET /api/budget/summary - Budget summary by category
 * GET /api/budget/items - List expenses with filters
 * POST /api/budget/items - Add expense
 * PUT /api/budget/items/:id - Update expense
 * DELETE /api/budget/items/:id - Delete expense
 * GET /api/budget/export - Export as CSV
 */

const crypto = require('crypto');
const kv = require('../lib/kv');

// Fixed wedding ID for Akhila & Akshay's wedding
const WEDDING_ID = 'akhila-akshay-2026';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET' && req.url.includes('/summary')) {
      return handleGetSummary(req, res);
    }

    if (req.method === 'GET' && req.url.includes('/items') && !req.url.includes('/export')) {
      return handleListItems(req, res);
    }

    if (req.method === 'POST' && req.url.includes('/items')) {
      return handleAddItem(req, res);
    }

    if (req.method === 'PUT' && req.url.match(/\/items\/[a-z0-9]+$/i)) {
      return handleUpdateItem(req, res);
    }

    if (req.method === 'DELETE' && req.url.match(/\/items\/[a-z0-9]+$/i)) {
      return handleDeleteItem(req, res);
    }

    if (req.method === 'GET' && req.url.includes('/export')) {
      return handleExport(req, res);
    }

    res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Budget API error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function handleGetSummary(req, res) {
    const budgetKey = `wedding:$\{WEDDING_ID\}:budget`;
  const items = (await kv.get(budgetKey)) || [];

  const categories = [
    'venue', 'catering', 'photography', 'florist', 'music',
    'decor', 'attire', 'rings', 'invitations', 'transportation', 'misc'
  ];

  const summary = {
    totalBudgeted: 0,
    totalActual: 0,
    totalRemaining: 0,
    byCategory: {}
  };

  categories.forEach(cat => {
    const catItems = items.filter(i => i.category === cat);
    summary.byCategory[cat] = {
      budgeted: catItems.reduce((sum, i) => sum + (i.budgeted || 0), 0),
      actual: catItems.reduce((sum, i) => sum + (i.actual || 0), 0),
      count: catItems.length,
      status: calculateStatus(catItems)
    };
    summary.totalBudgeted += summary.byCategory[cat].budgeted;
    summary.totalActual += summary.byCategory[cat].actual;
  });

  summary.totalRemaining = summary.totalBudgeted - summary.totalActual;

  res.json(summary);
}

function calculateStatus(items) {
  if (items.length === 0) return 'none';
  const paid = items.filter(i => i.status === 'paid').length;
  const partial = items.filter(i => i.status === 'partial').length;

  if (paid === items.length) return 'paid';
  if (paid + partial === items.length) return 'partial';
  return 'pending';
}

async function handleListItems(req, res) {
    const budgetKey = `wedding:$\{WEDDING_ID\}:budget`;
  const items = (await kv.get(budgetKey)) || [];

  const url = new URL(req.url, 'http://localhost');
  const category = url.searchParams.get('category');
  const status = url.searchParams.get('status');

  let filtered = items;

  if (category && category !== 'all') {
    filtered = filtered.filter(i => i.category === category);
  }

  if (status && status !== 'all') {
    filtered = filtered.filter(i => i.status === status);
  }

  res.json({
    items: filtered,
    total: items.length
  });
}

async function handleAddItem(req, res) {
    if (user.role !== 'admin' && user.role !== 'planner') {
    return res.status(403).json({ error: 'Only admins and planners can add expenses' });
  }

  const { description, category, budgeted, actual, status, vendor, dueDate, notes } = req.body;

  if (!description || !category) {
    return res.status(400).json({ error: 'Description and category required' });
  }

  const itemId = crypto.randomBytes(8).toString('hex');
  const item = {
    id: itemId,
    weddingId: user.weddingId,
    description,
    category,
    budgeted: parseFloat(budgeted) || 0,
    actual: parseFloat(actual) || 0,
    status: status || 'pending',
    vendor: vendor || '',
    dueDate: dueDate || '',
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const budgetKey = `wedding:$\{WEDDING_ID\}:budget`;
  const items = (await kv.get(budgetKey)) || [];
  items.push(item);
  await kv.set(budgetKey, items);

  res.status(201).json(item);
}

async function handleUpdateItem(req, res) {
    if (user.role !== 'admin' && user.role !== 'planner') {
    return res.status(403).json({ error: 'Only admins and planners can update expenses' });
  }

  const itemId = req.url.match(/\/items\/([a-z0-9]+)$/i)[1];

  const budgetKey = `wedding:$\{WEDDING_ID\}:budget`;
  const items = (await kv.get(budgetKey)) || [];
  const itemIndex = items.findIndex(i => i.id === itemId);

  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  const item = items[itemIndex];
  const { description, category, budgeted, actual, status, vendor, dueDate, notes } = req.body;

  if (description !== undefined) item.description = description;
  if (category !== undefined) item.category = category;
  if (budgeted !== undefined) item.budgeted = parseFloat(budgeted);
  if (actual !== undefined) item.actual = parseFloat(actual);
  if (status !== undefined) item.status = status;
  if (vendor !== undefined) item.vendor = vendor;
  if (dueDate !== undefined) item.dueDate = dueDate;
  if (notes !== undefined) item.notes = notes;

  item.updatedAt = new Date().toISOString();

  items[itemIndex] = item;
  await kv.set(budgetKey, items);

  res.json(item);
}

async function handleDeleteItem(req, res) {
    if (user.role !== 'admin' && user.role !== 'planner') {
    return res.status(403).json({ error: 'Only admins and planners can delete expenses' });
  }

  const itemId = req.url.match(/\/items\/([a-z0-9]+)$/i)[1];

  const budgetKey = `wedding:$\{WEDDING_ID\}:budget`;
  const items = (await kv.get(budgetKey)) || [];
  const filtered = items.filter(i => i.id !== itemId);

  if (filtered.length === items.length) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  await kv.set(budgetKey, filtered);

  res.json({ success: true, message: 'Expense deleted' });
}

async function handleExport(req, res) {
    const budgetKey = `wedding:$\{WEDDING_ID\}:budget`;
  const items = (await kv.get(budgetKey)) || [];

  const csv = [
    ['Description', 'Category', 'Budgeted', 'Actual', 'Status', 'Vendor', 'Due Date', 'Notes'].join(',')
  ];

  items.forEach(i => {
    csv.push([
      `"${i.description}"`,
      i.category,
      i.budgeted || 0,
      i.actual || 0,
      i.status,
      `"${i.vendor || ''}"`,
      i.dueDate || '',
      `"${i.notes || ''}"`
    ].join(','));
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="budget.csv"');
  res.send(csv.join('\n'));
}

