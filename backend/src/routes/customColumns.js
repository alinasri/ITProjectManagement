const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const { section_id } = req.query;
  const sectionId = req.user.role === 'section_head' ? req.user.section_id : section_id;
  if (!sectionId) return res.json(db.prepare('SELECT * FROM custom_columns ORDER BY section_id, column_order').all());
  res.json(db.prepare('SELECT * FROM custom_columns WHERE section_id = ? ORDER BY column_order').all(sectionId));
});

router.post('/', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const { column_name, section_id } = req.body;
  if (!column_name?.trim()) return res.status(400).json({ error: 'column_name required' });
  const sectionId = req.user.role === 'section_head' ? req.user.section_id : section_id;
  if (!sectionId) return res.status(400).json({ error: 'section_id required' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(column_order),0) as m FROM custom_columns WHERE section_id = ?').get(sectionId).m;
  const result = db.prepare('INSERT INTO custom_columns (section_id, column_name, column_order) VALUES (?, ?, ?)').run(sectionId, column_name.trim(), maxOrder + 1);
  res.status(201).json(db.prepare('SELECT * FROM custom_columns WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:id', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const col = db.prepare('SELECT * FROM custom_columns WHERE id = ?').get(req.params.id);
  if (!col) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'section_head' && col.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.prepare('DELETE FROM custom_columns WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
