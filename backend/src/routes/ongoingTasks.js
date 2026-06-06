const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function enrichTasks(tasks) {
  return tasks.map(t => {
    const responsibles = db.prepare(
      `SELECT per.id, per.name FROM ongoing_task_responsibles otr
       JOIN personnel per ON per.id = otr.personnel_id
       WHERE otr.task_id = ? ORDER BY per.name`
    ).all(t.id);
    return { ...t, responsibles };
  });
}

function setResponsibles(table, fk, id, personnelIds) {
  db.prepare(`DELETE FROM ${table} WHERE ${fk} = ?`).run(id);
  const insert = db.prepare(`INSERT INTO ${table} (${fk}, personnel_id) VALUES (?, ?)`);
  personnelIds.forEach(pid => insert.run(id, pid));
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
  const { title, section_id, responsible_ids, note } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  const sectionId = req.user.role === 'section_head' ? req.user.section_id : section_id;
  if (!sectionId) return res.status(400).json({ error: 'section_id required' });

  const result = db.prepare(
    `INSERT INTO ongoing_tasks (title, section_id, note)
     VALUES (?, ?, ?)`
  ).run(title.trim(), sectionId, note || '');
  const taskId = result.lastInsertRowid;
  if (Array.isArray(responsible_ids)) setResponsibles('ongoing_task_responsibles', 'task_id', taskId, responsible_ids);
  const task = db.prepare('SELECT * FROM ongoing_tasks WHERE id = ?').get(taskId);
  res.status(201).json(enrichTasks([task])[0]);
});

router.put('/:id', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const task = db.prepare('SELECT * FROM ongoing_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'section_head' && task.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { title, responsible_ids, note } = req.body;
  db.prepare(
    `UPDATE ongoing_tasks SET title = ?, note = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    title ?? task.title,
    note ?? task.note,
    req.params.id
  );

  if (Array.isArray(responsible_ids)) setResponsibles('ongoing_task_responsibles', 'task_id', req.params.id, responsible_ids);

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
