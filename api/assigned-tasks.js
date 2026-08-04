/**
 * Assigned Tasks API — simple owner-to-responsibility assignments.
 */

const kv = require('../lib/kv');
const { requireDashboardEditPassword } = require('../lib/dashboard-edit');

const WEDDING_ID = 'akhila-akshay-2026';
const KEY = `wedding:${WEDDING_ID}:assigned-tasks`;
const DEFAULT_ASSIGNMENTS = [
  { id: 'assignment_pranav_mara', name: 'Pranav Mara', tasks: ['Alcohol'] },
  { id: 'assignment_alekhya_chennaboina', name: 'Alekhya Chennaboina', tasks: ['Choreographer', 'Cakes'] }
];

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeTasks(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(values.map(task => cleanText(task, 80)).filter(Boolean))];
}

function normalizeAssignment(value) {
  return {
    ...value,
    name: cleanText(value?.name, 100),
    tasks: normalizeTasks(value?.tasks)
  };
}

async function getAssignments() {
  const stored = await kv.get(KEY);
  const source = Array.isArray(stored) ? stored : DEFAULT_ASSIGNMENTS;
  return source.map(normalizeAssignment);
}

module.exports = async (req, res) => {
  const method = req.method;
  const url = new URL(req.url, 'http://localhost');
  const id = cleanText(url.searchParams.get('id'), 120);

  try {
    if (method === 'GET') {
      return res.status(200).json(await getAssignments());
    }

    if (!requireDashboardEditPassword(req, res)) return;

    if (method === 'POST') {
      const assignment = normalizeAssignment(req.body || {});
      if (!assignment.name || assignment.tasks.length === 0) {
        return res.status(400).json({ error: 'Name and at least one task are required' });
      }

      const assignments = await getAssignments();
      const record = {
        ...assignment,
        id: `assignment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      assignments.push(record);
      await kv.set(KEY, assignments);
      return res.status(201).json(record);
    }

    if (method === 'DELETE' && id) {
      const assignments = await getAssignments();
      const nextAssignments = assignments.filter(assignment => assignment.id !== id);
      if (nextAssignments.length === assignments.length) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      await kv.set(KEY, nextAssignments);
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Assigned tasks API error:', error);
    return res.status(500).json({ error: 'Failed to manage assigned tasks' });
  }
};
