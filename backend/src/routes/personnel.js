const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Section heads see their own; admin sees all
router.get('/', requireAuth, (req, res) => {
  const { section_id } = req.query;
  if (req.user.role === 'section_head') {
    return res.json(
      db.prepare('SELECT * FROM personnel WHERE section_id = ? ORDER BY name').all(req.user.section_id)
    );
  }
  if (section_id) {
    return res.json(
      db.prepare('SELECT * FROM personnel WHERE section_id = ? ORDER BY name').all(section_id)
    );
  }
  res.json(db.prepare('SELECT * FROM personnel ORDER BY section_id, name').all());
});

router.post('/', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const { name, section_id } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const sectionId = req.user.role === 'section_head' ? req.user.section_id : section_id;
  if (!sectionId) return res.status(400).json({ error: 'section_id required' });
  const result = db.prepare('INSERT INTO personnel (name, section_id) VALUES (?, ?)').run(name.trim(), sectionId);
  res.status(201).json(db.prepare('SELECT * FROM personnel WHERE id = ?').get(result.lastInsertRowid));
});


router.delete('/:id', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const person = db.prepare('SELECT * FROM personnel WHERE id = ?').get(req.params.id);
  if (!person) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'section_head' && person.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.prepare('DELETE FROM personnel WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
