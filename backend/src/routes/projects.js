const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function enrichProjects(projects) {
  return projects.map(p => {
    const responsible = p.responsible_id
      ? db.prepare('SELECT id, name FROM personnel WHERE id = ?').get(p.responsible_id)
      : null;
    const customValues = db.prepare(
      'SELECT cv.column_id, cv.value, cc.column_name FROM custom_values cv JOIN custom_columns cc ON cc.id = cv.column_id WHERE cv.project_id = ?'
    ).all(p.id);
    return { ...p, responsible, custom_values: customValues };
  });
}

router.get('/', requireAuth, (req, res) => {
  const { section_id } = req.query;
  let projects;
  if (req.user.role === 'section_head') {
    projects = db.prepare('SELECT * FROM projects WHERE section_id = ? ORDER BY row_order, id').all(req.user.section_id);
  } else if (section_id) {
    projects = db.prepare('SELECT * FROM projects WHERE section_id = ? ORDER BY row_order, id').all(section_id);
  } else {
    projects = db.prepare('SELECT * FROM projects ORDER BY section_id, row_order, id').all();
  }
  res.json(enrichProjects(projects));
});

router.post('/', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const { title, section_id, responsible_id, status, future_plan, problems, row_order } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  const sectionId = req.user.role === 'section_head' ? req.user.section_id : section_id;
  if (!sectionId) return res.status(400).json({ error: 'section_id required' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(row_order),0) as m FROM projects WHERE section_id = ?').get(sectionId).m;
  const result = db.prepare(
    `INSERT INTO projects (title, section_id, responsible_id, status, future_plan, problems, row_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    title.trim(), sectionId, responsible_id || null,
    status || 'not_started', future_plan || '', problems || '',
    row_order ?? maxOrder + 1
  );
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(enrichProjects([project])[0]);
});

router.put('/:id', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'section_head' && project.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { title, responsible_id, status, future_plan, problems, row_order, custom_values } = req.body;
  db.prepare(
    `UPDATE projects SET title = ?, responsible_id = ?, status = ?, future_plan = ?, problems = ?, row_order = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    title ?? project.title,
    responsible_id !== undefined ? responsible_id : project.responsible_id,
    status ?? project.status,
    future_plan ?? project.future_plan,
    problems ?? project.problems,
    row_order ?? project.row_order,
    req.params.id
  );

  if (Array.isArray(custom_values)) {
    const upsert = db.prepare(
      'INSERT INTO custom_values (project_id, column_id, value) VALUES (?, ?, ?) ON CONFLICT(project_id, column_id) DO UPDATE SET value = excluded.value'
    );
    custom_values.forEach(({ column_id, value }) => upsert.run(req.params.id, column_id, value ?? ''));
  }

  res.json(enrichProjects([db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)])[0]);
});

router.delete('/:id', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'section_head' && project.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
