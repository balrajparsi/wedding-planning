/**
 * Authentication API Endpoints
 * POST /api/auth/login - Login with email/password
 * POST /api/auth/signup - Create new wedding account (admin)
 * POST /api/auth/invite-planner - Send planner invite (admin only)
 * POST /api/auth/accept-invite - Accept invite and create account
 */

const crypto = require('crypto');
const JWT = require('../lib/jwt');
const kv = require('../lib/kv');

const jwt = new JWT();

// Hash password using crypto
function hashPassword(password) {
  return crypto
    .createHash('sha256')
    .update(password + process.env.JWT_SECRET)
    .digest('hex');
}

// Verify password
function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

// Login endpoint
module.exports = async function handler(req, res) {
  if (req.method === 'POST' && req.url.includes('/login')) {
    return handleLogin(req, res);
  }

  if (req.method === 'POST' && req.url.includes('/signup')) {
    return handleSignup(req, res);
  }

  if (req.method === 'POST' && req.url.includes('/invite-planner')) {
    return handleInvitePlanner(req, res);
  }

  if (req.method === 'POST' && req.url.includes('/accept-invite')) {
    return handleAcceptInvite(req, res);
  }

  res.status(404).json({ error: 'Not found' });
}

async function handleLogin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Get user from KV
    const userKey = `user:${email}`;
    const user = await kv.get(userKey);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({
      id: user.id,
      email: user.email,
      weddingId: user.weddingId,
      role: user.role
    });

    // Remove password hash before returning
    const userResponse = { ...user };
    delete userResponse.passwordHash;

    res.json({
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

async function handleSignup(req, res) {
  try {
    const { email, password, coupleName, weddingDate } = req.body;

    if (!email || !password || !coupleName || !weddingDate) {
      return res.status(400).json({
        error: 'Email, password, couple name, and wedding date required'
      });
    }

    // Check if email already exists
    const userKey = `user:${email}`;
    const existingUser = await kv.get(userKey);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create wedding
    const weddingId = crypto.randomBytes(8).toString('hex');
    const wedding = {
      id: weddingId,
      coupleName,
      weddingDate,
      createdAt: new Date().toISOString(),
      currency: 'INR'
    };

    // Create admin user
    const userId = crypto.randomBytes(8).toString('hex');
    const user = {
      id: userId,
      email,
      name: coupleName.split('&')[0].trim(), // Extract bride name as default
      role: 'admin',
      weddingId,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };

    // Save to KV
    await kv.set(`wedding:${weddingId}`, wedding);
    await kv.set(userKey, user);
    await kv.set(`wedding:${weddingId}:users`, [user]);

    // Generate token
    const token = jwt.sign({
      id: user.id,
      email: user.email,
      weddingId: user.weddingId,
      role: user.role
    });

    const userResponse = { ...user };
    delete userResponse.passwordHash;

    res.json({
      token,
      user: userResponse,
      wedding
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
}

async function handleInvitePlanner(req, res) {
  try {
    const { email, role } = req.body;
    const authToken = req.headers.authorization?.split(' ')[1];

    if (!authToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify user is admin
    const payload = jwt.verify(authToken);
    const user = await kv.get(`user:${payload.email}`);

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can invite planners' });
    }

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role required' });
    }

    // Create invite token
    const inviteToken = jwt.sign(
      {
        email,
        weddingId: user.weddingId,
        role,
        type: 'invite'
      },
      '7d'
    );

    // Store invite
    const inviteKey = `invite:${inviteToken}`;
    await kv.set(inviteKey, {
      email,
      weddingId: user.weddingId,
      role,
      createdAt: new Date().toISOString(),
      accepted: false
    });

    // In production, send email here with invite link:
    // const inviteLink = `https://yourapp.com/accept-invite?token=${inviteToken}`;
    // await sendEmail(email, 'You are invited to plan Akhila & Akshay\'s wedding!', inviteLink);

    res.json({
      success: true,
      message: 'Invite sent',
      inviteToken // Return token for development
    });
  } catch (error) {
    console.error('Invite planner error:', error);
    res.status(500).json({ error: 'Failed to send invite' });
  }
}

async function handleAcceptInvite(req, res) {
  try {
    const { inviteToken, password, name } = req.body;

    if (!inviteToken || !password || !name) {
      return res.status(400).json({
        error: 'Invite token, password, and name required'
      });
    }

    // Verify invite token
    const payload = jwt.verify(inviteToken);
    const inviteKey = `invite:${inviteToken}`;
    const invite = await kv.get(inviteKey);

    if (!invite || invite.accepted) {
      return res.status(400).json({ error: 'Invalid or already accepted invite' });
    }

    // Check if user already exists
    const userKey = `user:${payload.email}`;
    const existingUser = await kv.get(userKey);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create new planner user
    const userId = crypto.randomBytes(8).toString('hex');
    const newUser = {
      id: userId,
      email: payload.email,
      name,
      role: payload.role,
      weddingId: payload.weddingId,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };

    // Save user and mark invite as accepted
    await kv.set(userKey, newUser);
    await kv.set(inviteKey, { ...invite, accepted: true, acceptedAt: new Date().toISOString() });

    // Add to wedding users list
    const usersKey = `wedding:${payload.weddingId}:users`;
    const users = (await kv.get(usersKey)) || [];
    users.push(newUser);
    await kv.set(usersKey, users);

    // Generate token
    const token = jwt.sign({
      id: newUser.id,
      email: newUser.email,
      weddingId: newUser.weddingId,
      role: newUser.role
    });

    const userResponse = { ...newUser };
    delete userResponse.passwordHash;

    res.json({
      token,
      user: userResponse,
      message: 'Account created successfully'
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
}
