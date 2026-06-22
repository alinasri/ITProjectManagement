// routes/personnel.js — CRUD for personnel (people who can be assigned to projects/tasks).
// Mounted at /api/personnel in app.js.

const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/personnel — lists personnel, with role-based data scoping.
// Rather than a role check in middleware, scoping is done inside the handler because
// the filtering rule depends on the user's data (their section_id), not just their role.
// section_head users always see only their own section, regardless of query params.
router.get('/', requireAuth, (req, res) => {
  const { section_id } = req.query;  // req.query holds URL query string params (?section_id=3)
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

// POST /api/personnel — creates a new person. super_admin or section_head.
// A section_head's section is forced to their own section_id regardless of what
// the request body says — prevents cross-section data manipulation.
router.post('/', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const { name, section_id } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const sectionId = req.user.role === 'section_head' ? req.user.section_id : section_id;
  if (!sectionId) return res.status(400).json({ error: 'section_id required' });
  const result = db.prepare('INSERT INTO personnel (name, section_id) VALUES (?, ?)').run(name.trim(), sectionId);
  res.status(201).json(db.prepare('SELECT * FROM personnel WHERE id = ?').get(result.lastInsertRowid));
});


// DELETE /api/personnel/:id — hard-deletes a person.
// Because project_responsibles and ongoing_task_responsibles use ON DELETE CASCADE,
// deleting a person automatically removes all their assignments from those join tables.
router.delete('/:id', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const person = db.prepare('SELECT * FROM personnel WHERE id = ?').get(req.params.id);
  if (!person) return res.status(404).json({ error: 'Not found' });
  // section_head can only delete personnel from their own section, not others'.
  if (req.user.role === 'section_head' && person.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.prepare('DELETE FROM personnel WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
