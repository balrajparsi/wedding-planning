/**
 * Task Management API — only deletions require the shared edit password
 * Uses ?id= query param for all ID-based operations
 */

const crypto = require('crypto');
const kv     = require('../lib/kv');
const { requireDashboardEditPassword } = require('../lib/dashboard-edit');

const WEDDING_ID = 'akhila-akshay-2026';
const TASKS_KEY  = `wedding:${WEDDING_ID}:tasks`;
const ASSIGNED_TASKS_MIGRATION_KEY = `wedding:${WEDDING_ID}:migration:assigned-task-todos-v1`;
const ASSIGNED_RESPONSIBILITY_TASKS = [
  {
    id: 'assigned_todo_pranav_alcohol',
    title: 'Alcohol',
    category: 'food',
    assignees: ['Pranav Mara']
  },
  {
    id: 'assigned_todo_alekhya_choreographer',
    title: 'Choreographer',
    category: 'vendors',
    assignees: ['Alekhya Chennaboina']
  },
  {
    id: 'assigned_todo_alekhya_cakes',
    title: 'Cakes',
    category: 'food',
    assignees: ['Alekhya Chennaboina']
  }
];

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'DELETE' && !requireDashboardEditPassword(req, res)) return;

    const url    = new URL(req.url, 'http://localhost');
    const sp     = url.searchParams;
    const id     = sp.get('id')     || '';
    const action = sp.get('action') || '';
    const subId  = sp.get('subId')  || '';

    if (req.method === 'GET')                            return handleListTasks(sp, res);
    if (req.method === 'POST' && !id)                    return handleAddTask(req, res);
    if (req.method === 'PUT'    && id && (action === 'subtasks' || action === 'subtask')) return handleUpdateSubtask(id, subId, req, res);
    if (req.method === 'POST'   && id && action === 'subtasks') return handleAddSubtask(id, req, res);
    if (req.method === 'PUT'    && id)                   return handleUpdateTask(id, req, res);
    if (req.method === 'DELETE' && id)                   return handleDeleteTask(id, res);

    res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Tasks API error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

async function handleListTasks(sp, res) {
  let tasks    = await ensureAssignedResponsibilityTasks();
  const cat    = sp.get('category');
  const stat   = sp.get('status');
  const assign = sp.get('assignee');
  const sort   = sp.get('sortBy') || 'dueDate';

  if (cat)    tasks = tasks.filter(t => t.category === cat);
  if (stat)   tasks = tasks.filter(t => t.status   === stat);
  if (assign) tasks = tasks.filter(t => t.assignees?.includes(assign));

  tasks.sort((a, b) => {
    if (sort === 'priority') {
      const ord = { high:0, medium:1, low:2 };
      return (ord[a.priority]||2) - (ord[b.priority]||2);
    }
    return (a.dueDate||'9999').localeCompare(b.dueDate||'9999');
  });

  res.json({
    tasks,
    stats: {
      total:      tasks.length,
      pending:    tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      completed:  tasks.filter(t => t.status === 'completed').length
    }
  });
}

async function ensureAssignedResponsibilityTasks() {
  const tasks = await kv.get(TASKS_KEY) || [];
  const migrationComplete = await kv.get(ASSIGNED_TASKS_MIGRATION_KEY);
  if (migrationComplete) return tasks;

  const now = new Date().toISOString();
  ASSIGNED_RESPONSIBILITY_TASKS.forEach(template => {
    const alreadyExists = tasks.some(task =>
      task.id === template.id ||
      (
        String(task.title || '').trim().toLowerCase() === template.title.toLowerCase() &&
        task.assignees?.includes(template.assignees[0])
      )
    );

    if (!alreadyExists) {
      tasks.push({
        ...template,
        weddingId: WEDDING_ID,
        dueDate: '',
        priority: 'medium',
        status: 'pending',
        notes: 'Added from Assigned Tasks',
        subtasks: [],
        createdAt: now,
        updatedAt: now
      });
    }
  });

  await kv.set(TASKS_KEY, tasks);
  await kv.set(ASSIGNED_TASKS_MIGRATION_KEY, { completedAt: now });
  return tasks;
}

async function handleAddTask(req, res) {
  const { title, category, dueDate, assignees, priority, notes } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Task title required' });

  const task = {
    id:        crypto.randomBytes(8).toString('hex'),
    weddingId: WEDDING_ID, title,
    category:  category  || 'general',
    dueDate:   dueDate   || '',
    assignees: assignees || [],
    priority:  priority  || 'medium',
    status:    'pending',
    notes:     notes     || '',
    subtasks:  [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const tasks = (await kv.get(TASKS_KEY)) || [];
  tasks.push(task);
  await kv.set(TASKS_KEY, tasks);
  res.status(201).json(task);
}

async function handleUpdateTask(id, req, res) {
  const tasks = (await kv.get(TASKS_KEY)) || [];
  const idx   = tasks.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });

  const t = tasks[idx];
  const b = req.body || {};
  if (b.title    !== undefined) t.title    = b.title;
  if (b.category !== undefined) t.category = b.category;
  if (b.dueDate  !== undefined) t.dueDate  = b.dueDate;
  if (b.assignees!== undefined) t.assignees= b.assignees;
  if (b.priority !== undefined) t.priority = b.priority;
  if (b.notes    !== undefined) t.notes    = b.notes;
  if (b.status   !== undefined) {
    t.status = b.status;
    if (b.status === 'completed') t.completedAt = new Date().toISOString();
  }
  t.updatedAt = new Date().toISOString();
  tasks[idx] = t;
  await kv.set(TASKS_KEY, tasks);
  res.json(t);
}

async function handleDeleteTask(id, res) {
  const tasks    = (await kv.get(TASKS_KEY)) || [];
  const filtered = tasks.filter(t => t.id !== id);
  if (filtered.length === tasks.length) return res.status(404).json({ error: 'Task not found' });
  await kv.set(TASKS_KEY, filtered);
  res.json({ success: true });
}

async function handleAddSubtask(taskId, req, res) {
  const { title } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Subtask title required' });

  const tasks = (await kv.get(TASKS_KEY)) || [];
  const task  = tasks.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const subtask = {
    id: crypto.randomBytes(4).toString('hex'),
    title, completed: false,
    createdAt: new Date().toISOString()
  };
  task.subtasks = task.subtasks || [];
  task.subtasks.push(subtask);
  task.updatedAt = new Date().toISOString();
  await kv.set(TASKS_KEY, tasks);
  res.status(201).json(subtask);
}

async function handleUpdateSubtask(taskId, subtaskId, req, res) {
  const tasks = (await kv.get(TASKS_KEY)) || [];
  const task  = tasks.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const subtask = (task.subtasks||[]).find(s => s.id === subtaskId);
  if (!subtask) return res.status(404).json({ error: 'Subtask not found' });

  const b = req.body || {};
  if (b.completed !== undefined) subtask.completed = b.completed;
  if (b.title     !== undefined) subtask.title     = b.title;
  if (b.response  !== undefined) subtask.response  = b.response;
  if (b.notes     !== undefined) subtask.notes     = b.notes;
  task.updatedAt = new Date().toISOString();
  await kv.set(TASKS_KEY, tasks);
  res.json(subtask);
}
