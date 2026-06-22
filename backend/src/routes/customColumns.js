// routes/customColumns.js — CRUD for custom columns on the projects table.
// Sections can define their own extra columns; values are stored in custom_values.
// Mounted at /api/custom-columns in app.js.

const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/custom-columns — lists custom column definitions.
// section_head automatically sees only their own section's columns.
// Admins can filter by ?section_id= or see all columns across all sections.
router.get('/', requireAuth, (req, res) => {
  const { section_id } = req.query;
  const sectionId = req.user.role === 'section_head' ? req.user.section_id : section_id;
  if (!sectionId) return res.json(db.prepare('SELECT * FROM custom_columns ORDER BY section_id, column_order').all());
  res.json(db.prepare('SELECT * FROM custom_columns WHERE section_id = ? ORDER BY column_order').all(sectionId));
});

// POST /api/custom-columns — adds a new custom column for a section.
// Auto-assigns the next column_order so the new column appears last in the list.
router.post('/', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const { column_name, section_id } = req.body;
  if (!column_name?.trim()) return res.status(400).json({ error: 'column_name required' });
  const sectionId = req.user.role === 'section_head' ? req.user.section_id : section_id;
  if (!sectionId) return res.status(400).json({ error: 'section_id required' });

  // COALESCE(MAX(column_order), 0): MAX returns NULL when there are no rows; COALESCE
  // returns the first non-null argument, so we get 0 instead of NULL for the first column.
  // Adding 1 makes the new column appear after all existing ones.
  const maxOrder = db.prepare('SELECT COALESCE(MAX(column_order),0) as m FROM custom_columns WHERE section_id = ?').get(sectionId).m;
  const result = db.prepare('INSERT INTO custom_columns (section_id, column_name, column_order) VALUES (?, ?, ?)').run(sectionId, column_name.trim(), maxOrder + 1);
  res.status(201).json(db.prepare('SELECT * FROM custom_columns WHERE id = ?').get(result.lastInsertRowid));
});

// DELETE /api/custom-columns/:id — hard-deletes a column definition.
// Because custom_values has ON DELETE CASCADE referencing custom_columns, all stored
// values for this column are automatically removed from every project when it is deleted.
router.delete('/:id', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const col = db.prepare('SELECT * FROM custom_columns WHERE id = ?').get(req.params.id);
  if (!col) return res.status(404).json({ error: 'Not found' });
  // section_head can only delete columns belonging to their own section.
  if (req.user.role === 'section_head' && col.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.prepare('DELETE FROM custom_columns WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
