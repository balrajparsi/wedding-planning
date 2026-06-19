/**
 * Budget Tracking API — USD, payment-log model
 * GET  /api/budget               - List all expenses
 * POST /api/budget               - Add expense
 * PUT  /api/budget?id=:id        - Update expense details
 * DELETE /api/budget?id=:id      - Delete expense
 * POST /api/budget?id=:id&action=payment  - Log a payment
 * GET  /api/budget?action=export - Export CSV
 */

const crypto = require('crypto');
const kv     = require('../lib/kv');

const WEDDING_ID = 'akhila-akshay-2026';
const BUDGET_KEY = `wedding:${WEDDING_ID}:budget`;
const CATEGORIES = ['venue','catering','photography','florist','music','decor','attire','rings','invitations','transportation','food','makeup-hair','misc'];

function normalizeCategory(value) {
  const raw = String(value || '').trim().toLowerCase();
  const compact = raw.replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const aliases = {
    'makeup': 'makeup-hair',
    'hair': 'makeup-hair',
    'makeup-hair': 'makeup-hair',
    'makeup-and-hair': 'makeup-hair',
    'makeup-hair-beauty': 'makeup-hair',
    'music-dj': 'music',
    'dj': 'music',
    'rings-jewelry': 'rings',
    'jewelry': 'rings',
    'other': 'misc',
    'miscellaneous': 'misc'
  };
  const normalized = aliases[compact] || compact;
  return CATEGORIES.includes(normalized) ? normalized : 'misc';
}

function computeExpense(item) {
  const paid = (item.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  return {
    ...item,
    paidAmount: paid,
    remaining: (parseFloat(item.totalCost) || 0) - paid,
    status: paid === 0 ? 'unpaid' : paid >= (parseFloat(item.totalCost) || 0) ? 'paid' : 'partial'
  };
}

module.exports = async function handler(req, res) {
  try {
    const url    = new URL(req.url, 'http://localhost');
    const sp     = url.searchParams;
    const id     = sp.get('id')     || '';
    const action = sp.get('action') || '';

    if (req.method === 'GET'    && action === 'export') return handleExport(res);
    if (req.method === 'GET')                           return handleList(res);
    if (req.method === 'POST'   && id && action === 'payment') return handleAddPayment(id, req, res);
    if (req.method === 'POST'   && !id)                 return handleAdd(req, res);
    if (req.method === 'PUT'    && id)                  return handleUpdate(id, req, res);
    if (req.method === 'DELETE' && id)                  return handleDelete(id, res);

    res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Budget API error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

async function handleList(res) {
  const items = (await kv.get(BUDGET_KEY)) || [];
  const enriched = items.map(computeExpense);
  const totalCost  = enriched.reduce((s, i) => s + (parseFloat(i.totalCost) || 0), 0);
  const totalPaid  = enriched.reduce((s, i) => s + i.paidAmount, 0);
  res.json({ items: enriched, summary: { totalCost, totalPaid, totalRemaining: totalCost - totalPaid } });
}

async function handleAdd(req, res) {
  const { description, category, totalCost, vendor, notes, source, vendorId } = req.body || {};
  if (!description || !category) return res.status(400).json({ error: 'Description and category required' });

  const item = {
    id:          crypto.randomBytes(8).toString('hex'),
    weddingId:   WEDDING_ID,
    description,
    category:    normalizeCategory(category),
    totalCost:   parseFloat(totalCost) || 0,
    vendor:      vendor || '',
    notes:       notes  || '',
    source:      source || '',
    vendorId:    vendorId || '',
    payments:    [],
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString()
  };

  const items = (await kv.get(BUDGET_KEY)) || [];
  items.push(item);
  await kv.set(BUDGET_KEY, items);
  res.status(201).json(computeExpense(item));
}

async function handleAddPayment(id, req, res) {
  const { amount, date, notes } = req.body || {};
  if (!amount || !date) return res.status(400).json({ error: 'Amount and date required' });

  const items = (await kv.get(BUDGET_KEY)) || [];
  const item  = items.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Expense not found' });

  item.payments = item.payments || [];
  item.payments.push({
    id:     crypto.randomBytes(4).toString('hex'),
    amount: parseFloat(amount),
    date,
    notes: notes || '',
    loggedAt: new Date().toISOString()
  });
  item.updatedAt = new Date().toISOString();
  await kv.set(BUDGET_KEY, items);
  res.json(computeExpense(item));
}

async function handleUpdate(id, req, res) {
  const items = (await kv.get(BUDGET_KEY)) || [];
  const idx   = items.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Expense not found' });

  const item = items[idx];
  const b    = req.body || {};
  if (b.description !== undefined) item.description = b.description;
  if (b.category    !== undefined) item.category    = normalizeCategory(b.category);
  if (b.totalCost   !== undefined) item.totalCost   = parseFloat(b.totalCost) || 0;
  if (b.vendor      !== undefined) item.vendor      = b.vendor;
  if (b.notes       !== undefined) item.notes       = b.notes;
  if (b.source      !== undefined) item.source      = b.source;
  if (b.vendorId    !== undefined) item.vendorId    = b.vendorId;
  item.updatedAt = new Date().toISOString();
  items[idx] = item;
  await kv.set(BUDGET_KEY, items);
  res.json(computeExpense(item));
}

async function handleDelete(id, res) {
  const items    = (await kv.get(BUDGET_KEY)) || [];
  const filtered = items.filter(i => i.id !== id);
  if (filtered.length === items.length) return res.status(404).json({ error: 'Expense not found' });
  await kv.set(BUDGET_KEY, filtered);
  res.json({ success: true });
}

async function handleExport(res) {
  const items = (await kv.get(BUDGET_KEY)) || [];
  const rows = [
    ['Description','Category','Total Cost (USD)','Paid (USD)','Remaining (USD)','Status','Vendor','Notes'].join(','),
    ...items.map(i => {
      const e = computeExpense(i);
      return [`"${i.description}"`, i.category, e.totalCost.toFixed(2), e.paidAmount.toFixed(2), e.remaining.toFixed(2), e.status, `"${i.vendor||''}"`, `"${i.notes||''}"`].join(',');
    })
  ];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="budget.csv"');
  res.send(rows.join('\n'));
}
