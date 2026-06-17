const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recordStatusChange } = require('../db/helpers');

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
  const showArchived = req.query.archived === '1' ? 1 : 0;
  let tasks;
  if (req.user.role === 'section_head') {
    tasks = db.prepare('SELECT * FROM ongoing_tasks WHERE section_id = ? AND is_archived = ? AND is_deleted = 0 ORDER BY id').all(req.user.section_id, showArchived);
  } else if (section_id) {
    tasks = db.prepare('SELECT * FROM ongoing_tasks WHERE section_id = ? AND is_archived = ? AND is_deleted = 0 ORDER BY id').all(section_id, showArchived);
  } else {
    tasks = db.prepare('SELECT * FROM ongoing_tasks WHERE is_archived = ? AND is_deleted = 0 ORDER BY section_id, id').all(showArchived);
  }
  res.json(enrichTasks(tasks));
});

router.post('/', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const { title, section_id, responsible_ids, status, note, progress } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  const sectionId = req.user.role === 'section_head' ? req.user.section_id : section_id;
  if (!sectionId) return res.status(400).json({ error: 'section_id required' });

  const initialStatus = status || 'in_progress';
  const initialProgress = Math.min(100, Math.max(0, Number(progress) || 0));
  const result = db.prepare(
    `INSERT INTO ongoing_tasks (title, section_id, status, note, progress)
     VALUES (?, ?, ?, ?, ?)`
  ).run(title.trim(), sectionId, initialStatus, note || '', initialProgress);
  const taskId = result.lastInsertRowid;
  recordStatusChange('ongoing_task', taskId, null, initialStatus, req.user.id);
  if (Array.isArray(responsible_ids)) setResponsibles('ongoing_task_responsibles', 'task_id', taskId, responsible_ids);
  const task = db.prepare('SELECT * FROM ongoing_tasks WHERE id = ?').get(taskId);
  res.status(201).json(enrichTasks([task])[0]);
});

router.get('/:id/history', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT sh.*, u.username as changed_by_username
     FROM status_history sh
     LEFT JOIN users u ON u.id = sh.changed_by
     WHERE sh.entity_type = 'ongoing_task' AND sh.entity_id = ?
     ORDER BY sh.changed_at DESC`
  ).all(req.params.id);
  res.json(rows);
});

router.put('/:id', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const task = db.prepare('SELECT * FROM ongoing_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'section_head' && task.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { title, responsible_ids, status, note, progress } = req.body;
  const newStatus = status ?? task.status;
  const newProgress = progress != null ? Math.min(100, Math.max(0, Number(progress))) : (task.progress ?? 0);
  db.prepare(
    `UPDATE ongoing_tasks SET title = ?, status = ?, note = ?, progress = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    title ?? task.title,
    newStatus,
    note ?? task.note,
    newProgress,
    req.params.id
  );
  recordStatusChange('ongoing_task', req.params.id, task.status, newStatus, req.user.id);

  if (Array.isArray(responsible_ids)) setResponsibles('ongoing_task_responsibles', 'task_id', req.params.id, responsible_ids);

  res.json(enrichTasks([db.prepare('SELECT * FROM ongoing_tasks WHERE id = ?').get(req.params.id)])[0]);
});

router.patch('/:id/archive', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const task = db.prepare('SELECT * FROM ongoing_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'section_head' && task.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const archive = req.body.archive === false ? 0 : 1;
  db.prepare(`UPDATE ongoing_tasks SET is_archived = ?, updated_at = datetime('now') WHERE id = ?`).run(archive, req.params.id);
  res.json({ ok: true, is_archived: archive });
});

router.delete('/:id', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const task = db.prepare('SELECT * FROM ongoing_tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'section_head' && task.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const ageMs = Date.now() - new Date(task.created_at + 'Z').getTime();
  if (ageMs > 10 * 60 * 1000) {
    return res.status(409).json({ error: 'older_than_10_min' });
  }
  db.prepare('UPDATE ongoing_tasks SET is_deleted = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
