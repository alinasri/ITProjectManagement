const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function enrichTasks(tasks) {
  return tasks.map(t => {
    const responsible = t.responsible_id
      ? db.prepare('SELECT id, name FROM personnel WHERE id = ?').get(t.responsible_id)
      : null;
    return { ...t, responsible };
  });
}

router.get('/', requireAuth, (req, res) => {
  const { section_id } = req.query;
  let tasks;
  if (req.user.role === 'section_head') {
    tasks = db.prepare('SELECT * FROM ongoing_tasks WHERE section_id = ? ORDER BY id').all(req.user.section_id);
  } else if (section_id) {
    tasks = db.prepare('SELECT * FROM ongoing_tasks WHERE section_id = ? ORDER BY id').all(section_id);
  } else {
    tasks = db.prepare('SELECT * FROM ongoing_tasks ORDER BY section_id, id').all();
  }
  res.json(enrichTasks(tasks));
});

router.post('/', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const { title, section_id, responsible_id, note } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  const sectionId = req.user.role === 'section_head' ? req.user.section_id : section_id;
  if (!sectionId) return res.status(400).json({ error: 'section_id required' });

  const result = db.prepare(
    `INSERT INTO ongoing_tasks (title, section_id, responsible_id, note)
     VALUES (?, ?, ?, ?)`
  ).run(title.trim(), sectionId, responsible_id || null, note || '');
  const task = db.prepare('SELECT * FROM ongoing_tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(enrichTasks([task])[0]);
});

router.put('/:id', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const task = db.prepare('SELECT * FROM ongoing_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'section_head' && task.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { title, responsible_id, note } = req.body;
  db.prepare(
    `UPDATE ongoing_tasks SET title = ?, responsible_id = ?, note = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    title ?? task.title,
    responsible_id !== undefined ? responsible_id : task.responsible_id,
    note ?? task.note,
    req.params.id
  );

  res.json(enrichTasks([db.prepare('SELECT * FROM ongoing_tasks WHERE id = ?').get(req.params.id)])[0]);
});

router.delete('/:id', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const task = db.prepare('SELECT * FROM ongoing_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'section_head' && task.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.prepare('DELETE FROM ongoing_tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
