// repositories/projectRepository.js — All SQL for the projects table.
//
// A repository's ONLY job is data access: run queries and return rows.
// No business rules live here (e.g. "only section_head can edit their own section"
// belongs in the service layer, not here).
//
// All db.prepare() calls happen at module load time (outside any function).
// WHY: SQLite parses and compiles the SQL once; every subsequent call just binds
// the parameters and executes the pre-compiled plan. Much faster than preparing
// the same statement on every request.

const db = require('../db/schema');

// ── Prepared statements ───────────────────────────────────────────────────────

const stmts = {
  findBySection:   db.prepare('SELECT * FROM projects WHERE section_id = ? AND is_archived = ? AND is_deleted = 0 ORDER BY row_order, id'),
  findAll:         db.prepare('SELECT * FROM projects WHERE is_archived = ? AND is_deleted = 0 ORDER BY section_id, row_order, id'),
  findById:        db.prepare('SELECT * FROM projects WHERE id = ?'),
  maxOrder:        db.prepare('SELECT COALESCE(MAX(row_order),0) as m FROM projects WHERE section_id = ?'),
  create:          db.prepare('INSERT INTO projects (title, section_id, status, future_plan, problems, row_order, progress, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  update:          db.prepare("UPDATE projects SET title = ?, status = ?, future_plan = ?, problems = ?, row_order = ?, progress = ?, due_date = ?, updated_at = datetime('now') WHERE id = ?"),
  setArchived:     db.prepare("UPDATE projects SET is_archived = ?, updated_at = datetime('now') WHERE id = ?"),
  softDelete:      db.prepare('UPDATE projects SET is_deleted = 1 WHERE id = ?'),
  // ON CONFLICT upsert: inserts a new value, or updates it if (project_id, column_id) already exists.
  upsertCustom:    db.prepare('INSERT INTO custom_values (project_id, column_id, value) VALUES (?, ?, ?) ON CONFLICT(project_id, column_id) DO UPDATE SET value = excluded.value'),
  getHistory:      db.prepare("SELECT sh.*, u.username as changed_by_username FROM status_history sh LEFT JOIN users u ON u.id = sh.changed_by WHERE sh.entity_type = 'project' AND sh.entity_id = ? ORDER BY sh.changed_at DESC"),
  deadlineChanges: db.prepare(`
    SELECT sh.entity_id AS project_id, sh.from_status AS old_due_date, sh.to_status AS new_due_date,
           sh.changed_at, p.title AS project_title, p.section_id, u.username AS changed_by
    FROM status_history sh
    JOIN projects p ON p.id = sh.entity_id
    LEFT JOIN users u ON u.id = sh.changed_by
    WHERE sh.entity_type = 'project' AND sh.field = 'due_date'
      AND sh.changed_at >= datetime('now', '-30 days') AND p.is_deleted = 0
    ORDER BY sh.changed_at DESC
  `),
};

// ── Exported functions ────────────────────────────────────────────────────────

// enrich — takes an array of plain project rows and returns a new array where each
// project also has `responsibles` and `custom_values` arrays attached.
// Called after every query so all responses share a consistent, complete shape.
//
// Uses two bulk IN queries instead of one query per project.
// Example: 50 projects → 3 total queries instead of 101.
//
// db.prepare() is called inside this function (not at module load) because the
// IN clause needs exactly as many '?' as there are IDs — that count is only
// known at call time. IDs come from our own prior query, never from user input.
function enrich(projects) {
  if (projects.length === 0) return [];

  const ids = projects.map(p => p.id);
  const placeholders = ids.map(() => '?').join(',');

  // Fetch all responsibles and custom values for the entire set of projects at once.
  const allResponsibles = db.prepare(
    `SELECT pr.project_id, per.id, per.name
     FROM project_responsibles pr JOIN personnel per ON per.id = pr.personnel_id
     WHERE pr.project_id IN (${placeholders}) ORDER BY per.name`
  ).all(...ids);

  const allCustomValues = db.prepare(
    `SELECT cv.project_id, cv.column_id, cv.value, cc.column_name
     FROM custom_values cv JOIN custom_columns cc ON cc.id = cv.column_id
     WHERE cv.project_id IN (${placeholders})`
  ).all(...ids);

  // Group results by project_id using a Map so each lookup below is O(1).
  const responsiblesMap = new Map(ids.map(id => [id, []]));
  for (const r of allResponsibles) {
    responsiblesMap.get(r.project_id).push({ id: r.id, name: r.name });
  }

  const customValuesMap = new Map(ids.map(id => [id, []]));
  for (const cv of allCustomValues) {
    customValuesMap.get(cv.project_id).push({ column_id: cv.column_id, value: cv.value, column_name: cv.column_name });
  }

  return projects.map(p => ({
    ...p,
    responsibles:  responsiblesMap.get(p.id),
    custom_values: customValuesMap.get(p.id),
  }));
}

// findAll — returns projects, optionally filtered to one section and archive state.
function findAll({ sectionId, showArchived }) {
  if (sectionId) return stmts.findBySection.all(sectionId, showArchived);
  return stmts.findAll.all(showArchived);
}

// findById — returns a single project row, or undefined if not found.
function findById(id) {
  return stmts.findById.get(id);
}

// create — inserts a new project and returns the newly created row.
function create({ title, sectionId, status, future_plan, problems, row_order, progress, due_date }) {
  // COALESCE(MAX(row_order), 0) + 1 places the new project last in display order.
  const maxOrder = stmts.maxOrder.get(sectionId).m;
  const result = stmts.create.run(
    title, sectionId, status, future_plan, problems,
    row_order ?? maxOrder + 1,
    progress,
    due_date ?? null
  );
  return findById(result.lastInsertRowid);
}

// update — overwrites all mutable fields of a project and returns the updated row.
function update(id, { title, status, future_plan, problems, row_order, progress, due_date }) {
  stmts.update.run(title, status, future_plan, problems, row_order, progress, due_date, id);
  return findById(id);
}

function setArchived(id, archive) {
  stmts.setArchived.run(archive, id);
}

function softDelete(id) {
  stmts.softDelete.run(id);
}

// upsertCustomValues — inserts or updates custom column values for a project.
// custom_values is an array of { column_id, value } objects.
function upsertCustomValues(projectId, customValues) {
  customValues.forEach(({ column_id, value }) =>
    stmts.upsertCustom.run(projectId, column_id, value ?? '')
  );
}

function getHistory(id) {
  return stmts.getHistory.all(id);
}

function getDeadlineChanges() {
  return stmts.deadlineChanges.all();
}

module.exports = { enrich, findAll, findById, create, update, setArchived, softDelete, upsertCustomValues, getHistory, getDeadlineChanges };
