const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const sections = db.prepare('SELECT * FROM sections ORDER BY id').all();
  res.json(sections);
});

router.post('/', requireAuth, requireRole('super_admin'), (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const result = db.prepare("INSERT INTO sections (name) VALUES (?)").run(name.trim());
  res.status(201).json(db.prepare('SELECT * FROM sections WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', requireAuth, requireRole('super_admin'), (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  db.prepare("UPDATE sections SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name.trim(), req.params.id);
  const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(req.params.id);
  if (!section) return res.status(404).json({ error: 'Not found' });
  res.json(section);
});

router.delete('/:id', requireAuth, requireRole('super_admin'), (req, res) => {
  db.prepare('DELETE FROM sections WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
