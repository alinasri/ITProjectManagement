// routes/users.js — User management (CRUD for user accounts).
// Mounted at /api/users in app.js.
// All routes require super_admin — only the top-level admin can manage accounts.

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/users — lists all non-deleted users.
// requireAuth verifies the token; requireRole('super_admin') blocks anyone else.
router.get('/', requireAuth, requireRole('super_admin'), (req, res) => {
  // is_deleted = 0 filters out soft-deleted accounts. They are kept in the database
  // for audit trail purposes but should not appear in the UI.
  const users = db.prepare(
    'SELECT id, username, role, section_id, must_change_password, created_at, is_active FROM users WHERE is_deleted = 0 ORDER BY id'
  ).all();
  res.json(users);
});

// POST /api/users — creates a new user account.
// super_admin cannot be created here — only the initial seed creates one.
// New users get must_change_password = 1 so they set their own password on first login.
router.post('/', requireAuth, requireRole('super_admin'), (req, res) => {
  const { username, password, role, section_id } = req.body;

  // ?. (optional chaining): username?.trim() returns undefined instead of crashing
  // if username is null or undefined.
  if (!username?.trim() || !password || !role) {
    return res.status(400).json({ error: 'username, password and role are required' });
  }
  if (!['it_head', 'section_head', 'purchase_admin', 'tender_admin', 'contract_admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (role === 'section_head' && !section_id) {
    return res.status(400).json({ error: 'section_id required for section_head' });
  }

  // Check for duplicate username before inserting to return a meaningful error.
  // (The UNIQUE constraint would also prevent it, but its error message is less helpful.)
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) return res.status(409).json({ error: 'Username already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, role, section_id, must_change_password) VALUES (?, ?, ?, ?, 1)'
  ).run(username.trim(), hash, role, section_id || null);

  // result.lastInsertRowid: the auto-generated primary key of the newly inserted row.
  // Re-fetch and return the full record so the frontend gets the complete object.
  res.status(201).json(
    db.prepare('SELECT id, username, role, section_id, must_change_password FROM users WHERE id = ?').get(result.lastInsertRowid)
  );
});

// PUT /api/users/:id — updates an existing user.
// req.params.id is extracted from the /:id segment in the URL pattern.
router.put('/:id', requireAuth, requireRole('super_admin'), (req, res) => {
  const { username, password, role, section_id } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.role === 'super_admin') return res.status(403).json({ error: 'Cannot modify super_admin' });

  // Only hash a new password if one was provided; otherwise keep the existing hash.
  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;

  // ?? (nullish coalescing): use the new value if provided, keep old value if not.
  // This enables partial updates — the client only needs to send fields it wants to change.
  db.prepare(
    'UPDATE users SET username = ?, password_hash = ?, role = ?, section_id = ? WHERE id = ?'
  ).run(
    username?.trim() || user.username,
    newHash,
    role || user.role,
    section_id !== undefined ? section_id : user.section_id,
    req.params.id
  );
  res.json(db.prepare('SELECT id, username, role, section_id, must_change_password FROM users WHERE id = ?').get(req.params.id));
});

// PATCH /api/users/:id/toggle-active — enables or disables a user account.
// PATCH (vs PUT) signals a partial update to a single field — HTTP convention.
// Disabled users are rejected by requireAuth even if they hold a valid token.
router.patch('/:id/toggle-active', requireAuth, requireRole('super_admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.role === 'super_admin') return res.status(403).json({ error: 'Cannot disable super_admin' });
  const newActive = user.is_active === 1 ? 0 : 1;
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(newActive, req.params.id);
  res.json({ ok: true, is_active: newActive });
});

// DELETE /api/users/:id — soft-deletes a user (sets is_deleted = 1, row stays in database).
// The 10-minute age check prevents accidental deletion of established accounts;
// only users created within the last 10 minutes can be hard-removed.
router.delete('/:id', requireAuth, requireRole('super_admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.role === 'super_admin') return res.status(403).json({ error: 'Cannot delete super_admin' });

  // created_at is stored as a UTC string without the 'Z' suffix, so we append it
  // before parsing so JavaScript treats it as UTC (not local time).
  const ageMs = Date.now() - new Date(user.created_at + 'Z').getTime();
  if (ageMs > 10 * 60 * 1000) {
    return res.status(409).json({ error: 'older_than_10_min' });
  }
  db.prepare('UPDATE users SET is_deleted = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
