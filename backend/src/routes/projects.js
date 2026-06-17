const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recordStatusChange, recordFieldChange } = require('../db/helpers');

const router = express.Router();

function enrichProjects(projects) {
  return projects.map(p => {
    const responsibles = db.prepare(
      `SELECT per.id, per.name FROM project_responsibles pr
       JOIN personnel per ON per.id = pr.personnel_id
       WHERE pr.project_id = ? ORDER BY per.name`
    ).all(p.id);
    const customValues = db.prepare(
      'SELECT cv.column_id, cv.value, cc.column_name FROM custom_values cv JOIN custom_columns cc ON cc.id = cv.column_id WHERE cv.project_id = ?'
    ).all(p.id);
    return { ...p, responsibles, custom_values: customValues };
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
  let projects;
  if (req.user.role === 'section_head') {
    projects = db.prepare('SELECT * FROM projects WHERE section_id = ? AND is_archived = ? AND is_deleted = 0 ORDER BY row_order, id').all(req.user.section_id, showArchived);
  } else if (section_id) {
    projects = db.prepare('SELECT * FROM projects WHERE section_id = ? AND is_archived = ? AND is_deleted = 0 ORDER BY row_order, id').all(section_id, showArchived);
  } else {
    projects = db.prepare('SELECT * FROM projects WHERE is_archived = ? AND is_deleted = 0 ORDER BY section_id, row_order, id').all(showArchived);
  }
  res.json(enrichProjects(projects));
});

router.post('/', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const { title, section_id, responsible_ids, status, future_plan, problems, row_order, progress, due_date } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  const sectionId = req.user.role === 'section_head' ? req.user.section_id : section_id;
  if (!sectionId) return res.status(400).json({ error: 'section_id required' });

  const initialStatus = status || 'not_started';
  const initialProgress = Math.min(100, Math.max(0, Number(progress) || 0));
  const maxOrder = db.prepare('SELECT COALESCE(MAX(row_order),0) as m FROM projects WHERE section_id = ?').get(sectionId).m;
  const result = db.prepare(
    `INSERT INTO projects (title, section_id, status, future_plan, problems, row_order, progress, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    title.trim(), sectionId,
    initialStatus, future_plan || '', problems || '',
    row_order ?? maxOrder + 1,
    initialProgress,
    due_date || null
  );
  const projectId = result.lastInsertRowid;
  recordStatusChange('project', projectId, null, initialStatus, req.user.id);
  if (Array.isArray(responsible_ids)) setResponsibles('project_responsibles', 'project_id', projectId, responsible_ids);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  res.status(201).json(enrichProjects([project])[0]);
});

router.get('/deadline-changes', requireAuth, requireRole('super_admin', 'it_head'), (req, res) => {
  const rows = db.prepare(`
    SELECT
      sh.entity_id   AS project_id,
      sh.from_status AS old_due_date,
      sh.to_status   AS new_due_date,
      sh.changed_at,
      p.title        AS project_title,
      p.section_id,
      u.username     AS changed_by
    FROM status_history sh
    JOIN projects p ON p.id = sh.entity_id
    LEFT JOIN users u ON u.id = sh.changed_by
    WHERE sh.entity_type = 'project'
      AND sh.field = 'due_date'
      AND sh.changed_at >= datetime('now', '-30 days')
      AND p.is_deleted = 0
    ORDER BY sh.changed_at DESC
  `).all();
  res.json(rows);
});

router.get('/:id/history', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT sh.*, u.username as changed_by_username
     FROM status_history sh
     LEFT JOIN users u ON u.id = sh.changed_by
     WHERE sh.entity_type = 'project' AND sh.entity_id = ?
     ORDER BY sh.changed_at DESC`
  ).all(req.params.id);
  res.json(rows);
});

router.put('/:id', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'section_head' && project.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { title, responsible_ids, status, future_plan, problems, row_order, custom_values, progress, due_date } = req.body;
  const newStatus = status ?? project.status;
  const newProgress = progress != null ? Math.min(100, Math.max(0, Number(progress))) : (project.progress ?? 0);
  const newDueDate = due_date !== undefined ? (due_date || null) : project.due_date;
  db.prepare(
    `UPDATE projects SET title = ?, status = ?, future_plan = ?, problems = ?, row_order = ?, progress = ?, due_date = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    title ?? project.title,
    newStatus,
    future_plan ?? project.future_plan,
    problems ?? project.problems,
    row_order ?? project.row_order,
    newProgress,
    newDueDate,
    req.params.id
  );
  recordStatusChange('project', req.params.id, project.status, newStatus, req.user.id);
  if (newDueDate !== project.due_date) {
    recordFieldChange('project', req.params.id, 'due_date', project.due_date, newDueDate, req.user.id);
  }

  if (Array.isArray(responsible_ids)) setResponsibles('project_responsibles', 'project_id', req.params.id, responsible_ids);

  if (Array.isArray(custom_values)) {
    const upsert = db.prepare(
      'INSERT INTO custom_values (project_id, column_id, value) VALUES (?, ?, ?) ON CONFLICT(project_id, column_id) DO UPDATE SET value = excluded.value'
    );
    custom_values.forEach(({ column_id, value }) => upsert.run(req.params.id, column_id, value ?? ''));
  }

  res.json(enrichProjects([db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)])[0]);
});

router.patch('/:id/archive', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'section_head' && project.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const archive = req.body.archive === false ? 0 : 1;
  db.prepare(`UPDATE projects SET is_archived = ?, updated_at = datetime('now') WHERE id = ?`).run(archive, req.params.id);
  res.json({ ok: true, is_archived: archive });
});

router.delete('/:id', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'section_head' && project.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const ageMs = Date.now() - new Date(project.created_at + 'Z').getTime();
  if (ageMs > 10 * 60 * 1000) {
    return res.status(409).json({ error: 'older_than_10_min' });
  }
  db.prepare('UPDATE projects SET is_deleted = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
