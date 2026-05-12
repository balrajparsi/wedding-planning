/**
 * Upstash Redis REST API client
 * Uses pipeline endpoint for reliable JSON storage/retrieval
 */

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

  async get(key) {
    if (this.inMemory) return this.inMemory.get(key) ?? null;
    try {
      const results = await this._pipeline([['GET', key]]);
      const raw = results[0]?.result;
      if (raw === null || raw === undefined) return null;
      try { return JSON.parse(raw); } catch { return raw; }
    } catch (error) {
      console.error('KV get error:', error);
      return null;
    }
  }

  async set(key, value) {
    if (this.inMemory) { this.inMemory.set(key, value); return value; }
    try {
      const serialized = JSON.stringify(value);
      await this._pipeline([['SET', key, serialized]]);
      return value;
    } catch (error) {
      console.error('KV set error:', error);
      throw error;
    }
  }

  async delete(key) {
    if (this.inMemory) { this.inMemory.delete(key); return true; }
    try {
      const results = await this._pipeline([['DEL', key]]);
      return (results[0]?.result || 0) > 0;
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
