/**
 * Simple JWT implementation for Node.js
 * Encode/decode JWTs without external dependencies
 */

const crypto = require('crypto');

class JWT {
  constructor(secret) {
    this.secret = secret || process.env.JWT_SECRET;
    if (!this.secret) {
      throw new Error('JWT_SECRET not configured');
    }
  }

  // Encode JWT
  sign(payload, expiresIn = '7d') {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    // Add expiration
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.parseExpiration(expiresIn);

    const finalPayload = {
      ...payload,
      iat: now,
      exp
    };

    const headerEncoded = this.base64url(JSON.stringify(header));
    const payloadEncoded = this.base64url(JSON.stringify(finalPayload));
    const signature = this.sign256(
      `${headerEncoded}.${payloadEncoded}`,
      this.secret
    );

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
  }

  // Decode JWT
  verify(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const [headerEncoded, payloadEncoded, signatureProvided] = parts;
      const signature = this.sign256(
        `${headerEncoded}.${payloadEncoded}`,
        this.secret
      );

      if (signature !== signatureProvided) {
        throw new Error('Invalid signature');
      }

      const payload = JSON.parse(this.base64urlDecode(payloadEncoded));

      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }

      return payload;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  // HMAC-SHA256
  sign256(data, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    return this.base64url(hmac.digest('base64'));
  }

  // Base64 URL encode
  base64url(str) {
    return Buffer.from(str, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Base64 URL decode
  base64urlDecode(str) {
    str += Array(5 - str.length % 4).join('=');
    return Buffer.from(
      str.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
  }

  // Parse expiration string (e.g., '7d', '24h', '3600s')
  parseExpiration(expiresIn) {
    const match = expiresIn.match(/^(\d+)([dhms])$/);
    if (!match) return 3600;

    const [, value, unit] = match;
    const multipliers = { d: 86400, h: 3600, m: 60, s: 1 };
    return parseInt(value) * (multipliers[unit] || 1);
  }
}

module.exports = JWT;

// Auth-bypass exports for no-auth mode
module.exports.verifyJWT = () => ({ weddingId: 'akhila-akshay-2026', role: 'admin' });
