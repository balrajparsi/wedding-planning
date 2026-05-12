/**
 * Task Management API Endpoints
 * GET /api/tasks - List tasks with filters
 * POST /api/tasks - Create task
 * PUT /api/tasks/:id - Update task
 * DELETE /api/tasks/:id - Delete task
 * POST /api/tasks/:id/subtasks - Add subtask
 * PUT /api/tasks/:id/subtasks/:subId - Update subtask
 */

const crypto = require('crypto');
const kv = require('../lib/kv');

// Fixed wedding ID for Akhila & Akshay's wedding
const WEDDING_ID = 'akhila-akshay-2026';

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET' && req.url.includes('/tasks') && !req.url.includes('/subtasks')) {
      return handleListTasks(req, res);
    }

    if (req.method === 'POST' && req.url.includes('/tasks') && !req.url.includes('/subtasks')) {
      return handleAddTask(req, res);
    }

    if (req.method === 'PUT' && req.url.match(/\/tasks\/[a-z0-9]+$/i)) {
      return handleUpdateTask(req, res);
    }

    if (req.method === 'DELETE' && req.url.match(/\/tasks\/[a-z0-9]+$/i)) {
      return handleDeleteTask(req, res);
    }

    if (req.method === 'POST' && req.url.includes('/subtasks')) {
      return handleAddSubtask(req, res);
    }

    if (req.method === 'PUT' && req.url.includes('/subtasks')) {
      return handleUpdateSubtask(req, res);
    }

    res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Tasks API error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function handleListTasks(req, res) {
    const tasksKey = `wedding:$\{WEDDING_ID\}:tasks`;
  const tasks = (await kv.get(tasksKey)) || [];

  const url = new URL(req.url, 'http://localhost');
  const category = url.searchParams.get('category');
  const status = url.searchParams.get('status');
  const assignee = url.searchParams.get('assignee');
  const sortBy = url.searchParams.get('sortBy') || 'dueDate';

  let filtered = tasks;

  if (category && category !== 'all') {
    filtered = filtered.filter(t => t.category === category);
  }

  if (status && status !== 'all') {
    filtered = filtered.filter(t => t.status === status);
  }

  if (assignee && assignee !== 'all') {
    filtered = filtered.filter(t => t.assignees?.includes(assignee));
  }

  // Sort
  filtered.sort((a, b) => {
    if (sortBy === 'dueDate') {
      const aDate = new Date(a.dueDate || '9999-12-31');
      const bDate = new Date(b.dueDate || '9999-12-31');
      return aDate - bDate;
    } else if (sortBy === 'priority') {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    }
    return 0;
  });

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status !== 'completed' && new Date(t.dueDate) < new Date()).length
  };

  res.json({
    tasks: filtered,
    stats
  });
}

async function handleAddTask(req, res) {
    if (user.role !== 'admin' && user.role !== 'planner') {
    return res.status(403).json({ error: 'Only admins and planners can add tasks' });
  }

  const { title, category, dueDate, assignees, priority, notes } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Task title required' });
  }

  const taskId = crypto.randomBytes(8).toString('hex');
  const task = {
    id: taskId,
    weddingId: user.weddingId,
    title,
    category: category || 'general',
    dueDate: dueDate || '',
    assignees: assignees || [],
    priority: priority || 'medium',
    status: 'pending',
    notes: notes || '',
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const tasksKey = `wedding:$\{WEDDING_ID\}:tasks`;
  const tasks = (await kv.get(tasksKey)) || [];
  tasks.push(task);
  await kv.set(tasksKey, tasks);

  res.status(201).json(task);
}

async function handleUpdateTask(req, res) {
    const taskId = req.url.match(/\/tasks\/([a-z0-9]+)$/i)[1];

  const tasksKey = `wedding:$\{WEDDING_ID\}:tasks`;
  const tasks = (await kv.get(tasksKey)) || [];
  const taskIndex = tasks.findIndex(t => t.id === taskId);

  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const task = tasks[taskIndex];

  if (user.role !== 'admin' && user.role !== 'planner') {
    return res.status(403).json({ error: 'Only admins and planners can update tasks' });
  }

  const { title, category, dueDate, assignees, priority, status, notes } = req.body;

  if (title !== undefined) task.title = title;
  if (category !== undefined) task.category = category;
  if (dueDate !== undefined) task.dueDate = dueDate;
  if (assignees !== undefined) task.assignees = assignees;
  if (priority !== undefined) task.priority = priority;
  if (status !== undefined) {
    task.status = status;
    if (status === 'completed') {
      task.completedAt = new Date().toISOString();
    }
  }
  if (notes !== undefined) task.notes = notes;

  task.updatedAt = new Date().toISOString();

  tasks[taskIndex] = task;
  await kv.set(tasksKey, tasks);

  res.json(task);
}

async function handleDeleteTask(req, res) {
    if (user.role !== 'admin' && user.role !== 'planner') {
    return res.status(403).json({ error: 'Only admins and planners can delete tasks' });
  }

  const taskId = req.url.match(/\/tasks\/([a-z0-9]+)$/i)[1];

  const tasksKey = `wedding:$\{WEDDING_ID\}:tasks`;
  const tasks = (await kv.get(tasksKey)) || [];
  const filtered = tasks.filter(t => t.id !== taskId);

  if (filtered.length === tasks.length) {
    return res.status(404).json({ error: 'Task not found' });
  }

  await kv.set(tasksKey, filtered);

  res.json({ success: true, message: 'Task deleted' });
}

async function handleAddSubtask(req, res) {
    if (user.role !== 'admin' && user.role !== 'planner') {
    return res.status(403).json({ error: 'Only admins and planners can add subtasks' });
  }

  const taskId = req.url.match(/\/tasks\/([a-z0-9]+)/i)[1];
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Subtask title required' });
  }

  const tasksKey = `wedding:$\{WEDDING_ID\}:tasks`;
  const tasks = (await kv.get(tasksKey)) || [];
  const taskIndex = tasks.findIndex(t => t.id === taskId);

  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const subtaskId = crypto.randomBytes(8).toString('hex');
  const subtask = {
    id: subtaskId,
    title,
    completed: false,
    createdAt: new Date().toISOString()
  };

  tasks[taskIndex].subtasks.push(subtask);
  await kv.set(tasksKey, tasks);

  res.status(201).json(subtask);
}

async function handleUpdateSubtask(req, res) {
    if (user.role !== 'admin' && user.role !== 'planner') {
    return res.status(403).json({ error: 'Only admins and planners can update subtasks' });
  }

  const match = req.url.match(/\/tasks\/([a-z0-9]+)\/subtasks\/([a-z0-9]+)/i);
  const taskId = match[1];
  const subtaskId = match[2];

  const tasksKey = `wedding:$\{WEDDING_ID\}:tasks`;
  const tasks = (await kv.get(tasksKey)) || [];
  const taskIndex = tasks.findIndex(t => t.id === taskId);

  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const subtaskIndex = tasks[taskIndex].subtasks.findIndex(s => s.id === subtaskId);
  if (subtaskIndex === -1) {
    return res.status(404).json({ error: 'Subtask not found' });
  }

  const { completed, title } = req.body;

  if (completed !== undefined) tasks[taskIndex].subtasks[subtaskIndex].completed = completed;
  if (title !== undefined) tasks[taskIndex].subtasks[subtaskIndex].title = title;

  await kv.set(tasksKey, tasks);

  res.json(tasks[taskIndex].subtasks[subtaskIndex]);
}

