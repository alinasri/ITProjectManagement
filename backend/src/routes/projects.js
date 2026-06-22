// routes/projects.js — Full CRUD for projects, including responsibles, custom column values,
// archiving, status history, and deadline change tracking.
// Mounted at /api/projects in app.js.

const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recordStatusChange, recordFieldChange, setResponsibles } = require('../db/helpers');

const router = express.Router();

// enrichProjects — attaches related data to raw project rows before sending to the frontend.
// Takes an array of plain project rows (from the database) and returns a new array where
// each project also has:
//   - responsibles: array of { id, name } for each assigned person
//   - custom_values: array of { column_id, value, column_name } for each custom column value
//
// Called after every query so all responses share a consistent, complete shape.
// The spread operator { ...p, responsibles, custom_values } creates a new object with all
// of p's fields plus the two new arrays, without mutating the original row.
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


// GET /api/projects — lists projects with role-based scoping and archive filter.
// section_head users always see only their own section's projects.
// Other users can filter by ?section_id= or get all projects.
// ?archived=1 switches to showing archived projects instead of active ones.
router.get('/', requireAuth, (req, res) => {
  const { section_id } = req.query;
  // Convert the query string value '1' to the integer 1 for the SQL comparison.
  const showArchived = req.query.archived === '1' ? 1 : 0;
  let projects;
  if (req.user.role === 'section_head') {
    // req.user.section_id was embedded in the JWT by the login route.
    projects = db.prepare('SELECT * FROM projects WHERE section_id = ? AND is_archived = ? AND is_deleted = 0 ORDER BY row_order, id').all(req.user.section_id, showArchived);
  } else if (section_id) {
    projects = db.prepare('SELECT * FROM projects WHERE section_id = ? AND is_archived = ? AND is_deleted = 0 ORDER BY row_order, id').all(section_id, showArchived);
  } else {
    projects = db.prepare('SELECT * FROM projects WHERE is_archived = ? AND is_deleted = 0 ORDER BY section_id, row_order, id').all(showArchived);
  }
  res.json(enrichProjects(projects));
});

// POST /api/projects — creates a new project.
// super_admin or section_head only (not read-only roles like it_head).
router.post('/', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const { title, section_id, responsible_ids, status, future_plan, problems, row_order, progress, due_date } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  // section_head is always forced to their own section, overriding any section_id in the body.
  const sectionId = req.user.role === 'section_head' ? req.user.section_id : section_id;
  if (!sectionId) return res.status(400).json({ error: 'section_id required' });

  const initialStatus = status || 'not_started';
  // Math.min/max clamps progress to the valid range 0–100.
  const initialProgress = Math.min(100, Math.max(0, Number(progress) || 0));
  // Auto-increment row_order after the current maximum so the new project appears last.
  const maxOrder = db.prepare('SELECT COALESCE(MAX(row_order),0) as m FROM projects WHERE section_id = ?').get(sectionId).m;
  const result = db.prepare(
    `INSERT INTO projects (title, section_id, status, future_plan, problems, row_order, progress, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    title.trim(), sectionId,
    initialStatus, future_plan || '', problems || '',
    row_order ?? maxOrder + 1,  // ?? uses the default only if row_order is null or undefined
    initialProgress,
    due_date || null
  );
  const projectId = result.lastInsertRowid;
  // Record the initial status with fromStatus = null (the project didn't exist before).
  recordStatusChange('project', projectId, null, initialStatus, req.user.id);
  if (Array.isArray(responsible_ids)) setResponsibles('project_responsibles', 'project_id', projectId, responsible_ids);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  res.status(201).json(enrichProjects([project])[0]);
});

// GET /api/projects/deadline-changes — returns due_date changes in the last 30 days.
// IMPORTANT: this route is defined BEFORE /:id/history. If it came after, Express would
// match the literal string "deadline-changes" as the :id parameter and this would never run.
// More specific routes must always come before dynamic (:param) routes.
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

// GET /api/projects/:id/history — returns the full status and field change log for one project.
// LEFT JOIN: includes history rows even if the user who made the change was later deleted
// (changed_by would be null in that case, and username would be null from the LEFT JOIN).
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

// PUT /api/projects/:id — full update of a project.
// Handles: main fields, status change audit, due date change audit, responsibles, custom values.
router.put('/:id', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  // section_head can only edit projects in their own section.
  if (req.user.role === 'section_head' && project.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { title, responsible_ids, status, future_plan, problems, row_order, custom_values, progress, due_date } = req.body;
  // ?? keeps the old value when the field is not provided in the request body.
  const newStatus = status ?? project.status;
  const newProgress = progress != null ? Math.min(100, Math.max(0, Number(progress))) : (project.progress ?? 0);
  // due_date !== undefined: if the field is explicitly sent (even as ''), update it.
  // If due_date is not in the body at all, keep the existing value.
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
    // Upsert: INSERT ... ON CONFLICT DO UPDATE SET.
    // If (project_id, column_id) already exists, update its value.
    // If it doesn't exist yet, insert a new row.
    // No need to check existence first — the database handles it atomically.
    const upsert = db.prepare(
      'INSERT INTO custom_values (project_id, column_id, value) VALUES (?, ?, ?) ON CONFLICT(project_id, column_id) DO UPDATE SET value = excluded.value'
    );
    custom_values.forEach(({ column_id, value }) => upsert.run(req.params.id, column_id, value ?? ''));
  }

  res.json(enrichProjects([db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)])[0]);
});

// PATCH /api/projects/:id/archive — archives or unarchives a project.
// PATCH signals a partial update to a single field (is_archived), not a full replacement.
router.patch('/:id/archive', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'section_head' && project.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Strict equality check: only the boolean false unarchives. Anything else (including
  // missing the field) defaults to archiving. This prevents accidental unarchiving.
  const archive = req.body.archive === false ? 0 : 1;
  db.prepare(`UPDATE projects SET is_archived = ?, updated_at = datetime('now') WHERE id = ?`).run(archive, req.params.id);
  res.json({ ok: true, is_archived: archive });
});

// DELETE /api/projects/:id — soft-deletes a project (sets is_deleted = 1).
// The row is never physically removed, preserving status_history and audit data.
// The 10-minute age window prevents accidental deletion of established records.
router.delete('/:id', requireAuth, requireRole('super_admin', 'section_head'), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'section_head' && project.section_id !== req.user.section_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Append 'Z' so JavaScript parses created_at as UTC, not local time.
  const ageMs = Date.now() - new Date(project.created_at + 'Z').getTime();
  if (ageMs > 10 * 60 * 1000) {
    return res.status(409).json({ error: 'older_than_10_min' });
  }
  db.prepare('UPDATE projects SET is_deleted = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
