// routes/sections.js — CRUD for organizational sections.
// Mounted at /api/sections in app.js.

const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/sections — returns all sections.
// Any authenticated user can read sections (needed to populate dropdowns everywhere).
router.get('/', requireAuth, (req, res) => {
  const sections = db.prepare('SELECT * FROM sections ORDER BY id').all();
  res.json(sections);
});

// POST /api/sections — creates a new section. Super admin only.
router.post('/', requireAuth, requireRole('super_admin'), (req, res) => {
  const { name } = req.body;
  // ?. (optional chaining) + .trim() safely handles null/undefined body values.
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const result = db.prepare("INSERT INTO sections (name) VALUES (?)").run(name.trim());
  // Return the full inserted record by re-fetching with the new auto-generated ID.
  res.status(201).json(db.prepare('SELECT * FROM sections WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/sections/:id — renames a section. Super admin only.
router.put('/:id', requireAuth, requireRole('super_admin'), (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  db.prepare("UPDATE sections SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name.trim(), req.params.id);
  const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(req.params.id);
  if (!section) return res.status(404).json({ error: 'Not found' });
  res.json(section);
});

// DELETE /api/sections/:id — hard-deletes a section. Super admin only.
// Unlike most other entities, sections use a real DELETE (not soft-delete) because
// they have no history-sensitive data. However, deletion is blocked if the section
// has any projects, tasks, or personnel — enforced manually here rather than relying
// on ON DELETE RESTRICT, to return a friendlier error message to the frontend.
router.delete('/:id', requireAuth, requireRole('super_admin'), (req, res) => {
  const id = req.params.id;
  const section = db.prepare('SELECT id FROM sections WHERE id = ?').get(id);
  if (!section) return res.status(404).json({ error: 'Not found' });

  // COUNT(*) returns a single row with one column 'c'. .get() fetches that one row.
  const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects WHERE section_id = ?').get(id).c;
  const taskCount = db.prepare('SELECT COUNT(*) as c FROM ongoing_tasks WHERE section_id = ?').get(id).c;
  const personnelCount = db.prepare('SELECT COUNT(*) as c FROM personnel WHERE section_id = ?').get(id).c;

  // 409 Conflict: the request is valid but blocked by a business rule.
  if (projectCount + taskCount + personnelCount > 0) {
    return res.status(409).json({ error: 'has_data' });
  }

  db.prepare('DELETE FROM sections WHERE id = ?').run(id);
  res.json({ ok: true });
});

module.exports = router;
