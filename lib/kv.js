/**
 * Vercel KV (Redis) client wrapper
 * Simple API for storing/retrieving wedding data
 */

class KVStore {
  constructor() {
    this.baseUrl = process.env.VERCEL_KV_REST_API_URL;
    this.token = process.env.VERCEL_KV_REST_API_TOKEN;

    if (!this.baseUrl || !this.token) {
      console.warn('KV store not configured - using in-memory fallback');
      this.inMemory = new Map();
    }
  }

  // Get value
  async get(key) {
    if (this.inMemory) {
      return this.inMemory.get(key) || null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/get/${key}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.result || null;
    } catch (error) {
      console.error('KV get error:', error);
      return null;
    }
  }

  // Set value
  async set(key, value) {
    if (this.inMemory) {
      this.inMemory.set(key, value);
      return value;
    }

    try {
      const response = await fetch(`${this.baseUrl}/set/${key}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value })
      });

      return await response.json();
    } catch (error) {
      console.error('KV set error:', error);
      throw error;
    }
  }

  // Delete value
  async delete(key) {
    if (this.inMemory) {
      this.inMemory.delete(key);
      return true;
    }

    try {
      const response = await fetch(`${this.baseUrl}/del/${key}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('KV delete error:', error);
      return false;
    }
  }

  // Scan keys by pattern
  async scan(pattern = '*') {
    if (this.inMemory) {
      const keys = Array.from(this.inMemory.keys());
      return pattern === '*' ? keys : keys.filter(k => k.includes(pattern));
    }

    try {
      const response = await fetch(`${this.baseUrl}/keys/${pattern}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) return [];
      const data = await response.json();
      return data.result || [];
    } catch (error) {
      console.error('KV scan error:', error);
      return [];
    }
  }

  // Increment counter
  async incr(key) {
    if (this.inMemory) {
      const current = parseInt(this.inMemory.get(key) || 0);
      const newValue = current + 1;
      this.inMemory.set(key, newValue);
      return newValue;
    }

    try {
      const response = await fetch(`${this.baseUrl}/incr/${key}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      const data = await response.json();
      return data.result || 0;
    } catch (error) {
      console.error('KV incr error:', error);
      return 0;
    }
  }
}

module.exports = new KVStore();
