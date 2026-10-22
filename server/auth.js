/**
 * auth.js  –  Queueless Authentication Module
 *
 * Strategy: simple JWT-based stateless sessions.
 * - POST /api/auth/login  → verifies email + password → returns JWT
 * - GET  /api/auth/me     → returns current user from token
 * - POST /api/auth/logout → client clears the token (stateless; no server-side revocation)
 *
 * Middleware helpers:
 *  requireAuth(req, res, next)        – any authenticated user
 *  requireRole(...roles)(req,res,next) – restrict to specific roles
 */

import crypto from 'node:crypto';
import { db } from './db.js';

// ─── JWT helpers (no external dependency, pure Node crypto) ──────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'queueless-dev-secret-2024-xK9mP';
const JWT_EXPIRY_HOURS = 12;

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function signJwt(payload) {
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body   = base64url(Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY_HOURS * 3600
  })));
  const sig = base64url(
    crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = base64url(
      crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest()
    );
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Password hashing ─────────────────────────────────────────────────────────

export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', salt).update(plain).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plain, stored) {
  try {
    const [salt, hash] = stored.split(':');
    const attempt = crypto.createHmac('sha256', salt).update(plain).digest('hex');
    return attempt === hash;
  } catch {
    return false;
  }
}

// ─── Ensure password column exists & seed default passwords ──────────────────

export function ensureAuthSchema() {
  // Add password_hash column if it doesn't exist yet
  try {
    db.exec(`ALTER TABLE staff_users ADD COLUMN password_hash TEXT;`);
  } catch (_) { /* column already exists */ }

  // Seed known demo accounts with a default password if they don't have one yet
  const defaultPassword = 'password123';
  const users = db.prepare(`SELECT id, email, role FROM staff_users WHERE password_hash IS NULL`).all();

  for (const u of users) {
    db.prepare(`UPDATE staff_users SET password_hash = ? WHERE id = ?`)
      .run(hashPassword(defaultPassword), u.id);
  }
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

export function extractToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  // Also accept cookie as fallback
  const cookie = req.headers['cookie'] || '';
  const match = cookie.match(/ql_token=([^;]+)/);
  if (match) return match[1];
  return null;
}

export function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const payload = verifyJwt(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired session' });

  req.authUser = payload;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!roles.includes(req.authUser.role)) {
        return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
      }
      next();
    });
  };
}

// ─── Staff / Admin Credential Authentication ─────────────────────────────────

export function authenticateCredentials(email, password, clientRole) {
  if (!email || !password) {
    const err = new Error('Email and password are required');
    err.statusCode = 400;
    throw err;
  }

  const user = db.prepare(`SELECT * FROM staff_users WHERE email = ?`).get(email.trim().toLowerCase());
  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  if (!user.password_hash) {
    const err = new Error('Account not activated. Contact your administrator.');
    err.statusCode = 403;
    throw err;
  }

  if (!verifyPassword(password, user.password_hash)) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  // Enforce portal-specific role restriction if specified
  if (clientRole && clientRole !== 'CUSTOMER' && user.role !== clientRole) {
    const err = new Error(`This account (${user.role}) cannot log in through the ${clientRole} portal`);
    err.statusCode = 403;
    throw err;
  }

  const tokenPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization_id: user.organization_id,
    assigned_counter_id: user.assigned_counter_id || null
  };

  const token = signJwt(tokenPayload);
  return { token, user: tokenPayload };
}

// ─── Auth route handlers ──────────────────────────────────────────────────────

export function registerAuthRoutes(app) {

  /**
   * POST /api/auth/login
   * Body: { email, password }
   * Response: { token, user: { id, name, email, role, organization_id } }
   *
   * Special case: CUSTOMER role has no DB record – any non-empty name is accepted
   * (matching the existing guest-customer behaviour).
   */
  app.post('/api/auth/login', (req, res) => {
    const { email, password, role: clientRole } = req.body;

    // ── Customer guest login ─────────────────────────────────────────────────
    // Customers don't have accounts; they enter their name to get a token.
    // The frontend sends role='CUSTOMER' with a name (email field carries name).
    if (clientRole === 'CUSTOMER') {
      const name = (email || '').trim();
      if (!name) return res.status(400).json({ error: 'Please enter your name to continue' });
      const token = signJwt({ id: 'usr_customer', name, role: 'CUSTOMER', organization_id: null });
      return res.json({
        token,
        user: { id: 'usr_customer', name, role: 'CUSTOMER', organization_id: null }
      });
    }

    // ── Staff / Admin login ──────────────────────────────────────────────────
    try {
      const result = authenticateCredentials(email, password, clientRole);
      res.json(result);
    } catch (err) {
      const status = err.statusCode || 401;
      res.status(status).json({ error: err.message });
    }
  });

  /**
   * GET /api/auth/me
   * Returns the currently authenticated user from the JWT.
   */
  app.get('/api/auth/me', requireAuth, (req, res) => {
    // Refresh user record from DB (in case details changed)
    if (req.authUser.role !== 'CUSTOMER') {
      const user = db.prepare(`SELECT * FROM staff_users WHERE id = ?`).get(req.authUser.id);
      if (!user) return res.status(401).json({ error: 'User not found' });
      return res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization_id: user.organization_id,
          assigned_counter_id: user.assigned_counter_id || null
        }
      });
    }
    res.json({ user: req.authUser });
  });

  /**
   * POST /api/auth/logout
   * Stateless JWT – client just deletes the token.
   * This endpoint exists so the frontend can call it cleanly.
   */
  app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true });
  });
}
