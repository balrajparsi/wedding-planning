/**
 * System-wide wedding data backups.
 * Covers every KV key for the wedding, including guests, tasks, budget,
 * vendors, venues, food, timeline, settings, users, and RSVP-related data.
 */

const kv = require('../lib/kv');
const { getEditPassword, requireDashboardEditPassword } = require('../lib/dashboard-edit');

const WEDDING_ID = 'akhila-akshay-2026';
const DATA_PREFIX = `wedding:${WEDDING_ID}`;
const SNAPSHOTS_KEY = `backup:${WEDDING_ID}:full-snapshots`;
const MAX_SNAPSHOTS = 10;

function cleanReason(value) {
  return String(value || 'manual').replace(/\s+/g, ' ').trim().slice(0, 80) || 'manual';
}

async function collectWeddingData() {
  const [weddingKeys, userKeys, inviteKeys] = await Promise.all([
    kv.scan(`${DATA_PREFIX}*`),
    kv.scan('user:*'),
    kv.scan('invite:*')
  ]);
  const candidateKeys = [...new Set([...weddingKeys, ...userKeys, ...inviteKeys])].sort();
  const values = await Promise.all(candidateKeys.map(key => kv.get(key)));
  const data = {};
  candidateKeys.forEach((key, index) => {
    const value = values[index];
    const belongsToWedding = key === DATA_PREFIX
      || key.startsWith(`${DATA_PREFIX}:`)
      || ((key.startsWith('user:') || key.startsWith('invite:')) && value?.weddingId === WEDDING_ID);
    if (belongsToWedding) data[key] = value;
  });
  return data;
}

function dataSignature(data) {
  return JSON.stringify(data || {});
}

async function createSnapshot(reason) {
  const data = await collectWeddingData();
  const keys = Object.keys(data);
  if (!keys.length) return { snapshot: null, created: false };

  const snapshots = await kv.get(SNAPSHOTS_KEY) || [];
  if (snapshots[0] && dataSignature(snapshots[0].data) === dataSignature(data)) {
    return { snapshot: snapshots[0], created: false };
  }

  const snapshot = {
    id: `backup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    reason: cleanReason(reason),
    keyCount: keys.length,
    data
  };
  snapshots.unshift(snapshot);
  await kv.set(SNAPSHOTS_KEY, snapshots.slice(0, MAX_SNAPSHOTS));
  return { snapshot, created: true };
}

function metadata(snapshot) {
  return {
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    reason: snapshot.reason,
    keyCount: snapshot.keyCount
  };
}

module.exports = async (req, res) => {
  const method = req.method;
  const url = new URL(req.url, 'http://localhost');
  const action = url.searchParams.get('action') || '';

  try {
    if (method === 'GET') {
      const snapshots = await kv.get(SNAPSHOTS_KEY) || [];
      return res.status(200).json({
        backups: snapshots.map(metadata),
        retention: MAX_SNAPSHOTS
      });
    }

    if (method === 'POST' && action === 'create') {
      const result = await createSnapshot(req.body?.reason);
      if (!result.snapshot) return res.status(404).json({ error: 'No wedding data is available to back up yet' });
      return res.status(result.created ? 201 : 200).json({
        success: true,
        created: result.created,
        backup: metadata(result.snapshot)
      });
    }

    if (method === 'POST' && action === 'restore') {
      if (!requireDashboardEditPassword(req, res)) return;
      if (String(req.body?.passcode || '').trim() !== getEditPassword()) {
        return res.status(403).json({ error: 'Invalid restore passcode' });
      }

      const snapshots = await kv.get(SNAPSHOTS_KEY) || [];
      if (!snapshots.length) return res.status(404).json({ error: 'No full dashboard backup is available yet' });

      const currentData = await collectWeddingData();
      const requestedId = String(req.body?.backupId || '').trim();
      const target = requestedId
        ? snapshots.find(snapshot => snapshot.id === requestedId)
        : snapshots.find(snapshot => dataSignature(snapshot.data) !== dataSignature(currentData));
      if (!target) return res.status(404).json({ error: 'No earlier dashboard version is available to restore' });

      await createSnapshot('before-full-restore');

      const targetKeys = new Set(Object.keys(target.data));
      const currentKeys = Object.keys(currentData);
      for (const [key, value] of Object.entries(target.data)) await kv.set(key, value);
      for (const key of currentKeys) {
        if (!targetKeys.has(key)) await kv.delete(key);
      }

      return res.status(200).json({
        success: true,
        restoredFrom: target.createdAt,
        restoredKeys: targetKeys.size
      });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Backups API error:', error);
    return res.status(500).json({ error: 'Failed to manage dashboard backups' });
  }
};
