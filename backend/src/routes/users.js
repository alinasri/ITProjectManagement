const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('super_admin'), (req, res) => {
  const users = db.prepare(
    'SELECT id, username, role, section_id, must_change_password, created_at, is_active FROM users WHERE is_deleted = 0 ORDER BY id'
  ).all();
  res.json(users);
});

router.post('/', requireAuth, requireRole('super_admin'), (req, res) => {
  const { username, password, role, section_id } = req.body;
  if (!username?.trim() || !password || !role) {
    return res.status(400).json({ error: 'username, password and role are required' });
  }
  if (!['it_head', 'section_head', 'purchase_admin', 'tender_admin', 'contract_admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (role === 'section_head' && !section_id) {
    return res.status(400).json({ error: 'section_id required for section_head' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) return res.status(409).json({ error: 'Username already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, role, section_id, must_change_password) VALUES (?, ?, ?, ?, 1)'
  ).run(username.trim(), hash, role, section_id || null);

  res.status(201).json(
    db.prepare('SELECT id, username, role, section_id, must_change_password FROM users WHERE id = ?').get(result.lastInsertRowid)
  );
});

router.put('/:id', requireAuth, requireRole('super_admin'), (req, res) => {
  const { username, password, role, section_id } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.role === 'super_admin') return res.status(403).json({ error: 'Cannot modify super_admin' });

  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;
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

router.patch('/:id/toggle-active', requireAuth, requireRole('super_admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.role === 'super_admin') return res.status(403).json({ error: 'Cannot disable super_admin' });
  const newActive = user.is_active === 1 ? 0 : 1;
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(newActive, req.params.id);
  res.json({ ok: true, is_active: newActive });
});

router.delete('/:id', requireAuth, requireRole('super_admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.role === 'super_admin') return res.status(403).json({ error: 'Cannot delete super_admin' });
  const ageMs = Date.now() - new Date(user.created_at + 'Z').getTime();
  if (ageMs > 10 * 60 * 1000) {
    return res.status(409).json({ error: 'older_than_10_min' });
  }
  db.prepare('UPDATE users SET is_deleted = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
