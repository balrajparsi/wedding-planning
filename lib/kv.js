/**
 * Vercel KV / Upstash Redis client wrapper
 * Supports both STORAGE_ prefix (Upstash with custom prefix) and KV_ prefix (default)
 */

class KVStore {
  constructor() {
    // Try multiple env var naming conventions
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

  async get(key) {
    if (this.inMemory) return this.inMemory.get(key) || null;
    try {
      const response = await fetch(`${this.baseUrl}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      if (!response.ok) return null;
      const data = await response.json();
      const result = data.result;
      if (result === null || result === undefined) return null;
      try { return JSON.parse(result); } catch { return result; }
    } catch (error) {
      console.error('KV get error:', error);
      return null;
    }
  }

  async set(key, value) {
    if (this.inMemory) { this.inMemory.set(key, value); return value; }
    try {
      const serialized = JSON.stringify(value);
      const response = await fetch(`${this.baseUrl}/set/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([serialized])
      });
      return await response.json();
    } catch (error) {
      console.error('KV set error:', error);
      throw error;
    }
  }

  async delete(key) {
    if (this.inMemory) { this.inMemory.delete(key); return true; }
    try {
      const response = await fetch(`${this.baseUrl}/del`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([key])
      });
      return response.ok;
    } catch (error) {
      console.error('KV delete error:', error);
      return false;
    }
  }

  async scan(pattern = '*') {
    if (this.inMemory) {
      const keys = Array.from(this.inMemory.keys());
      return pattern === '*' ? keys : keys.filter(k => k.includes(pattern.replace('*', '')));
    }
    try {
      const response = await fetch(`${this.baseUrl}/keys/${encodeURIComponent(pattern)}`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.result || [];
    } catch (error) {
      console.error('KV scan error:', error);
      return [];
    }
  }

  async incr(key) {
    if (this.inMemory) {
      const current = parseInt(this.inMemory.get(key) || 0);
      const newValue = current + 1;
      this.inMemory.set(key, newValue);
      return newValue;
    }
    try {
      const response = await fetch(`${this.baseUrl}/incr/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` }
      });
      const data = await response.json();
      return data.result || 0;
    } catch (error) {
      console.error('KV incr error:', error);
      return 0;
    }
  }
}

const kv = new KVStore();
module.exports = kv;
module.exports.getKV = () => kv;
