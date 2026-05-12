/**
 * Food & Menu Management API
 * Handles menu planning with dietary accommodations per guest
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
    // GET /api/food - List menu items with optional filters
    if (method === 'GET' && path === '/api/food') {
      const eventType = searchParams.get('eventType');
      const courseType = searchParams.get('courseType');

      const foodKey = `wedding:${weddingId}:food`;
      let menuItems = await kv.get(foodKey) || [];

      // Apply filters
      if (eventType) {
        menuItems = menuItems.filter(m => m.eventType === eventType);
      }
      if (courseType) {
        menuItems = menuItems.filter(m => m.courseType === courseType);
      }

      return res.status(200).json(menuItems);
    }

    // POST /api/food - Create new menu item
    if (method === 'POST' && path === '/api/food') {
      const { eventType, courseType, dish, vegNonVeg, cost, portionSize,
              preparedBy, cuisine, notes } = req.body;

      if (!dish || !eventType || !courseType) {
        return res.status(400).json({ error: 'Dish, event type, and course type required' });
      }

      const menuItem = {
        id: `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        weddingId,
        eventType, // main-wedding, pre-wedding, rehearsal, sangeet, mehendi, reception
        eventDate: '',
        courseType, // appetizers, mains, sides, desserts, beverages, snacks
        dish,
        vegNonVeg: vegNonVeg || 'both', // veg, non-veg, both
        cost: cost || 0,
        portionSize: portionSize || '1 plate',
        preparedBy: preparedBy || '', // vendor name or notes
        cuisine: cuisine || '', // indian, fusion, continental, other
        guestAccommodations: [], // Array of {guestId, modification}
        notes: notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const foodKey = `wedding:${weddingId}:food`;
      let menuItems = await kv.get(foodKey) || [];
      menuItems.push(menuItem);
      await kv.set(foodKey, menuItems);

      return res.status(201).json(menuItem);
    }

    // PUT /api/food/:id - Update menu item
    if (method === 'PUT' && path.startsWith('/api/food/')) {
      const foodId = path.split('/')[3];
      const updates = req.body;

      const foodKey = `wedding:${weddingId}:food`;
      let menuItems = await kv.get(foodKey) || [];
      const index = menuItems.findIndex(m => m.id === foodId);

      if (index === -1) {
        return res.status(404).json({ error: 'Menu item not found' });
      }

      menuItems[index] = {
        ...menuItems[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(foodKey, menuItems);
      return res.status(200).json(menuItems[index]);
    }

    // DELETE /api/food/:id - Delete menu item
    if (method === 'DELETE' && path.startsWith('/api/food/')) {
      const foodId = path.split('/')[3];

      const foodKey = `wedding:${weddingId}:food`;
      let menuItems = await kv.get(foodKey) || [];
      menuItems = menuItems.filter(m => m.id !== foodId);
      await kv.set(foodKey, menuItems);

      return res.status(200).json({ success: true });
    }

    // POST /api/food/:id/accommodation - Add guest dietary accommodation
    if (method === 'POST' && path.includes('/accommodation')) {
      const foodId = path.split('/')[3];
      const { guestId, modification } = req.body;

      if (!guestId || !modification) {
        return res.status(400).json({ error: 'Guest ID and modification required' });
      }

      const foodKey = `wedding:${weddingId}:food`;
      let menuItems = await kv.get(foodKey) || [];
      const menuItem = menuItems.find(m => m.id === foodId);

      if (!menuItem) {
        return res.status(404).json({ error: 'Menu item not found' });
      }

      // Check if accommodation already exists for this guest
      const existingIndex = menuItem.guestAccommodations.findIndex(a => a.guestId === guestId);
      if (existingIndex !== -1) {
        menuItem.guestAccommodations[existingIndex].modification = modification;
      } else {
        menuItem.guestAccommodations.push({ guestId, modification });
      }

      menuItem.updatedAt = new Date().toISOString();
      await kv.set(foodKey, menuItems);

      return res.status(200).json(menuItem);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Food API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

