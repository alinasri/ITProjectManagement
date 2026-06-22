// routes/auth.js — Authentication routes (login, logout, current user, change password).
// Mounted at /api/auth in app.js, so router.post('/login') handles POST /api/auth/login.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/schema');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

// express.Router() creates a self-contained mini-router. Routes defined here are relative
// to the prefix where this router is mounted (/api/auth).
const router = express.Router();

// POST /api/auth/login — validates credentials and issues a JWT token.
// No auth required — this is the entry point for unauthenticated users.
router.post('/login', (req, res) => {
  // req.body is the parsed JSON body (populated by express.json() in app.js).
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

  // The ? placeholder prevents SQL injection — never concatenate user input into SQL strings.
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  // bcrypt.compareSync compares the plain-text password against the stored one-way hash.
  // Even if the database leaks, hashed passwords cannot be reversed to plain text.
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  if (user.is_active === 0) {
    return res.status(403).json({ error: 'Account disabled' });
  }

  // jwt.sign() creates a signed token embedding the payload (id, username, role, section_id).
  // The server signs it with JWT_SECRET; only the server can verify the signature later.
  // expiresIn: '8h' — the token becomes invalid after 8 hours, forcing re-login.
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, section_id: user.section_id },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  // httpOnly: true — the browser stores the cookie but JavaScript cannot read it,
  // protecting against XSS attacks that try to steal tokens.
  // sameSite: 'lax' — the cookie is sent on same-site requests and top-level navigations.
  // maxAge mirrors the token's 8-hour expiry so the cookie and token expire together.
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 });

  // Also return the token in the response body so non-browser clients (e.g. mobile apps)
  // can store and use it via the Authorization header.
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      section_id: user.section_id,
      must_change_password: user.must_change_password === 1,
    },
  });
});

// POST /api/auth/logout — clears the session cookie.
// No auth required — even expired sessions should be clearable.
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// GET /api/auth/me — returns the currently logged-in user's profile.
// requireAuth runs first; if the token is invalid, it responds 401 and this handler never runs.
router.get('/me', requireAuth, (req, res) => {
  // req.user.id was set by requireAuth after verifying the JWT.
  // We re-fetch from the database to always return fresh, current data.
  const user = db.prepare('SELECT id, username, role, section_id, must_change_password FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ ...user, must_change_password: user.must_change_password === 1 });
});

// POST /api/auth/change-password — lets the logged-in user change their own password.
// requireAuth ensures only authenticated users can reach this handler.
router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is wrong' });
  }
  // bcrypt.hashSync hashes the new password with cost factor 10 before storing it.
  // Passwords are never stored in plain text.
  const hash = bcrypt.hashSync(new_password, 10);
  // Clear must_change_password so the "forced change" prompt does not reappear.
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
