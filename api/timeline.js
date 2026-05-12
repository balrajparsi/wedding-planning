/**
 * Timeline Management API
 * Handles milestones, deadlines, and event scheduling
 */

const { getKV } = require('../lib/kv');
const { verifyJWT } = require('../lib/jwt');

module.exports = async (req, res) => {
  const kv = getKV();

  // JWT verification middleware
  const token = req.headers.authorization?.replace('Bearer ', '');
  let user;
  try {
    user = verifyJWT(token);
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const weddingId = user.weddingId;
  const method = req.method;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const searchParams = url.searchParams;

  try {
    // GET /api/timeline - List all milestones chronologically
    if (method === 'GET' && path === '/api/timeline') {
      const type = searchParams.get('type'); // event, deadline, reminder, milestone

      const timelineKey = `wedding:${weddingId}:timeline`;
      let milestones = await kv.get(timelineKey) || [];

      // Apply filters
      if (type) {
        milestones = milestones.filter(m => m.type === type);
      }

      // Sort by date chronologically
      milestones = milestones.sort((a, b) => {
        const aDate = new Date(a.date).getTime();
        const bDate = new Date(b.date).getTime();
        return aDate - bDate;
      });

      return res.status(200).json(milestones);
    }

    // POST /api/timeline - Create new milestone
    if (method === 'POST' && path === '/api/timeline') {
      const { type, title, date, location, description, attendees, notes } = req.body;

      if (!type || !title || !date) {
        return res.status(400).json({ error: 'Type, title, and date required' });
      }

      const milestone = {
        id: `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        weddingId,
        type, // event, deadline, reminder, milestone
        title,
        date,
        location: location || '',
        description: description || '',
        attendees: attendees || [], // Array of names or emails
        notes: notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const timelineKey = `wedding:${weddingId}:timeline`;
      let milestones = await kv.get(timelineKey) || [];
      milestones.push(milestone);
      await kv.set(timelineKey, milestones);

      return res.status(201).json(milestone);
    }

    // PUT /api/timeline/:id - Update milestone
    if (method === 'PUT' && path.startsWith('/api/timeline/')) {
      const milestoneId = path.split('/')[3];
      const updates = req.body;

      const timelineKey = `wedding:${weddingId}:timeline`;
      let milestones = await kv.get(timelineKey) || [];
      const index = milestones.findIndex(m => m.id === milestoneId);

      if (index === -1) {
        return res.status(404).json({ error: 'Milestone not found' });
      }

      milestones[index] = {
        ...milestones[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(timelineKey, milestones);
      return res.status(200).json(milestones[index]);
    }

    // DELETE /api/timeline/:id - Delete milestone
    if (method === 'DELETE' && path.startsWith('/api/timeline/')) {
      const milestoneId = path.split('/')[3];

      const timelineKey = `wedding:${weddingId}:timeline`;
      let milestones = await kv.get(timelineKey) || [];
      milestones = milestones.filter(m => m.id !== milestoneId);
      await kv.set(timelineKey, milestones);

      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Timeline API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
