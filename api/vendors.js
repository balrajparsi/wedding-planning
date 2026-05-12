/**
 * Vendor Management API
 * Handles vendor CRUD, document uploads, booking status tracking
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
    // GET /api/vendors - List all vendors with optional filters
    if (method === 'GET' && path === '/api/vendors') {
      const category = searchParams.get('category');
      const status = searchParams.get('status');
      const eventType = searchParams.get('eventType'); // Filter by related event

      const vendorsKey = `wedding:${weddingId}:vendors`;
      let vendors = await kv.get(vendorsKey) || [];

      // Apply filters
      if (category) {
        vendors = vendors.filter(v => v.category === category);
      }
      if (status) {
        vendors = vendors.filter(v => v.status === status);
      }
      if (eventType) {
        vendors = vendors.filter(v => v.eventType === eventType);
      }

      // Sort by booking status (confirmed first) then by service date
      vendors = vendors.sort((a, b) => {
        const statusOrder = { confirmed: 0, negotiating: 1, inquiry: 2, paid: -1 };
        const statusDiff = (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
        if (statusDiff !== 0) return statusDiff;

        const aDate = a.serviceDate ? new Date(a.serviceDate).getTime() : Infinity;
        const bDate = b.serviceDate ? new Date(b.serviceDate).getTime() : Infinity;
        return aDate - bDate;
      });

      return res.status(200).json(vendors);
    }

    // POST /api/vendors - Create new vendor
    if (method === 'POST' && path === '/api/vendors') {
      const { name, category, contactName, email, phone, website, eventType,
              status, bookedDate, serviceDate, costEstimate, notes } = req.body;

      if (!name || !category) {
        return res.status(400).json({ error: 'Name and category required' });
      }

      const vendor = {
        id: `vendor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        weddingId,
        name,
        category, // photography, catering, florist, music, decor, venue, transportation, makeup, etc.
        contactName: contactName || '',
        email: email || '',
        phone: phone || '',
        website: website || '',
        eventType: eventType || '', // ceremony, rehearsal, sangeet, mehendi, reception, pre-wedding
        status: status || 'inquiry', // inquiry, negotiating, confirmed, paid
        bookedDate: bookedDate || '',
        serviceDate: serviceDate || '',
        costEstimate: costEstimate || 0,
        costActual: 0,
        notes: notes || '',
        documents: [], // Array of {name, url}
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const vendorsKey = `wedding:${weddingId}:vendors`;
      let vendors = await kv.get(vendorsKey) || [];
      vendors.push(vendor);
      await kv.set(vendorsKey, vendors);

      return res.status(201).json(vendor);
    }

    // PUT /api/vendors/:id - Update vendor
    if (method === 'PUT' && path.startsWith('/api/vendors/')) {
      const vendorId = path.split('/')[3];
      const updates = req.body;

      const vendorsKey = `wedding:${weddingId}:vendors`;
      let vendors = await kv.get(vendorsKey) || [];
      const index = vendors.findIndex(v => v.id === vendorId);

      if (index === -1) {
        return res.status(404).json({ error: 'Vendor not found' });
      }

      vendors[index] = {
        ...vendors[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(vendorsKey, vendors);
      return res.status(200).json(vendors[index]);
    }

    // DELETE /api/vendors/:id - Delete vendor
    if (method === 'DELETE' && path.startsWith('/api/vendors/')) {
      const vendorId = path.split('/')[3];

      const vendorsKey = `wedding:${weddingId}:vendors`;
      let vendors = await kv.get(vendorsKey) || [];
      vendors = vendors.filter(v => v.id !== vendorId);
      await kv.set(vendorsKey, vendors);

      return res.status(200).json({ success: true });
    }

    // POST /api/vendors/:id/documents - Add document to vendor
    if (method === 'POST' && path.includes('/documents')) {
      const vendorId = path.split('/')[3];
      const { documentName, documentUrl } = req.body;

      if (!documentName || !documentUrl) {
        return res.status(400).json({ error: 'Document name and URL required' });
      }

      const vendorsKey = `wedding:${weddingId}:vendors`;
      let vendors = await kv.get(vendorsKey) || [];
      const vendor = vendors.find(v => v.id === vendorId);

      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found' });
      }

      vendor.documents.push({
        name: documentName,
        url: documentUrl,
        uploadedAt: new Date().toISOString()
      });

      vendor.updatedAt = new Date().toISOString();
      await kv.set(vendorsKey, vendors);

      return res.status(200).json(vendor);
    }

    // DELETE /api/vendors/:id/documents/:docIndex - Remove document from vendor
    if (method === 'DELETE' && path.includes('/documents/')) {
      const parts = path.split('/');
      const vendorId = parts[3];
      const docIndex = parseInt(parts[5]);

      const vendorsKey = `wedding:${weddingId}:vendors`;
      let vendors = await kv.get(vendorsKey) || [];
      const vendor = vendors.find(v => v.id === vendorId);

      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found' });
      }

      vendor.documents.splice(docIndex, 1);
      vendor.updatedAt = new Date().toISOString();
      await kv.set(vendorsKey, vendors);

      return res.status(200).json(vendor);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Vendor API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

