/**
 * Upstash Redis REST API client
 * Uses pipeline endpoint for reliable JSON storage/retrieval
 */

const MAX_CHANGE_HISTORY = 25;

class KVStore {
  constructor() {
    this.baseUrl =
      process.env.STORAGE_REST_API_URL ||
      process.env.KV_REST_API_URL ||
      process.env.VERCEL_KV_REST_API_URL;

    this.token =
      process.env.STORAGE_REST_API_TOKEN ||
      process.env.KV_REST_API_TOKEN ||
      process.env.VERCEL_KV_REST_API_TOKEN;

    if (!this.baseUrl || !this.token) {
      console.warn('KV store not configured - using in-memory fallback');
      this.inMemory = new Map();
    }
  }

  _headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  async _pipeline(commands) {
    const response = await fetch(`${this.baseUrl}/pipeline`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(commands)
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upstash error ${response.status}: ${text}`);
    }
    return response.json();
  }

  _isWeddingDataKey(key) {
    return /^wedding:[^:]+(?::.*)?$/.test(String(key || ''));
  }

  _historyKey(key) {
    const weddingId = String(key).split(':')[1] || 'unknown';
    return `backup:${weddingId}:change-history`;
  }

  async _getRaw(key) {
    if (this.inMemory) return this.inMemory.get(key) ?? null;
    const results = await this._pipeline([['GET', key]]);
    const raw = results[0]?.result;
    if (raw === null || raw === undefined) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }

  async _setRaw(key, value) {
    if (this.inMemory) { this.inMemory.set(key, value); return value; }
    await this._pipeline([['SET', key, JSON.stringify(value)]]);
    return value;
  }

  async _deleteRaw(key) {
    if (this.inMemory) return this.inMemory.delete(key);
    const results = await this._pipeline([['DEL', key]]);
    return (results[0]?.result || 0) > 0;
  }

  async _archivePreviousValue(key, value) {
    if (!this._isWeddingDataKey(key) || value === null || value === undefined) return;
    const historyKey = this._historyKey(key);
    const history = await this._getRaw(historyKey) || [];
    history.unshift({
      id: `change_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      key,
      value
    });
    await this._setRaw(historyKey, history.slice(0, MAX_CHANGE_HISTORY));
  }

  async get(key) {
    try {
      return await this._getRaw(key);
    } catch (error) {
      console.error('KV get error:', error);
      return null;
    }
  }

  async set(key, value) {
    try {
      if (this._isWeddingDataKey(key)) {
        const previous = await this._getRaw(key);
        if (previous !== null && JSON.stringify(previous) !== JSON.stringify(value)) {
          await this._archivePreviousValue(key, previous);
        }
      }
      return await this._setRaw(key, value);
    } catch (error) {
      console.error('KV set error:', error);
      throw error;
    }
  }

  async delete(key) {
    try {
      if (this._isWeddingDataKey(key)) {
        const previous = await this._getRaw(key);
        await this._archivePreviousValue(key, previous);
      }
      return await this._deleteRaw(key);
    } catch (error) {
      console.error('KV delete error:', error);
      return false;
    }
  }

  async scan(pattern = '*') {
    if (this.inMemory) {
      const keys = Array.from(this.inMemory.keys());
      return pattern === '*' ? keys : keys.filter(k => k.includes(pattern.replace(/\*/g, '')));
    }
    try {
      const results = await this._pipeline([['KEYS', pattern]]);
      return results[0]?.result || [];
    } catch (error) {
      console.error('KV scan error:', error);
      return [];
    }
  }

  async incr(key) {
    if (this.inMemory) {
      const v = parseInt(this.inMemory.get(key) || 0) + 1;
      this.inMemory.set(key, v);
      return v;
    }
    try {
      const results = await this._pipeline([['INCR', key]]);
      return results[0]?.result || 0;
    } catch (error) {
      console.error('KV incr error:', error);
      return 0;
    }
  }
}

const kv = new KVStore();
module.exports = kv;
module.exports.getKV = () => kv;
