// repositories/ongoingTaskRepository.js — All SQL for the ongoing_tasks table.
// Same structure as projectRepository but simpler: no custom columns or due dates.

const db = require('../db/schema');

const stmts = {
  findBySection: db.prepare('SELECT * FROM ongoing_tasks WHERE section_id = ? AND is_archived = ? AND is_deleted = 0 ORDER BY id'),
  findAll:       db.prepare('SELECT * FROM ongoing_tasks WHERE is_archived = ? AND is_deleted = 0 ORDER BY section_id, id'),
  findById:      db.prepare('SELECT * FROM ongoing_tasks WHERE id = ?'),
  create:        db.prepare('INSERT INTO ongoing_tasks (title, section_id, status, note, progress) VALUES (?, ?, ?, ?, ?)'),
  update:        db.prepare("UPDATE ongoing_tasks SET title = ?, status = ?, note = ?, progress = ?, updated_at = datetime('now') WHERE id = ?"),
  setArchived:   db.prepare("UPDATE ongoing_tasks SET is_archived = ?, updated_at = datetime('now') WHERE id = ?"),
  softDelete:    db.prepare('UPDATE ongoing_tasks SET is_deleted = 1 WHERE id = ?'),
  getHistory:    db.prepare("SELECT sh.*, u.username as changed_by_username FROM status_history sh LEFT JOIN users u ON u.id = sh.changed_by WHERE sh.entity_type = 'ongoing_task' AND sh.entity_id = ? ORDER BY sh.changed_at DESC"),
};

// enrich — attaches the responsibles array to each plain task row.
// Uses one bulk IN query instead of one query per task.
// db.prepare() is inside this function because the IN clause length varies per call.
function enrich(tasks) {
  if (tasks.length === 0) return [];

  const ids = tasks.map(t => t.id);
  const placeholders = ids.map(() => '?').join(',');

  const allResponsibles = db.prepare(
    `SELECT otr.task_id, per.id, per.name
     FROM ongoing_task_responsibles otr JOIN personnel per ON per.id = otr.personnel_id
     WHERE otr.task_id IN (${placeholders}) ORDER BY per.name`
  ).all(...ids);

  // Group by task_id.
  const map = new Map(ids.map(id => [id, []]));
  for (const r of allResponsibles) {
    map.get(r.task_id).push({ id: r.id, name: r.name });
  }

  return tasks.map(t => ({ ...t, responsibles: map.get(t.id) }));
}

function findAll({ sectionId, showArchived }) {
  if (sectionId) return stmts.findBySection.all(sectionId, showArchived);
  return stmts.findAll.all(showArchived);
}

function findById(id) {
  return stmts.findById.get(id);
}

function create({ title, sectionId, status, note, progress }) {
  const result = stmts.create.run(title, sectionId, status, note, progress);
  return findById(result.lastInsertRowid);
}

function update(id, { title, status, note, progress }) {
  stmts.update.run(title, status, note, progress, id);
  return findById(id);
}

function setArchived(id, archive) { stmts.setArchived.run(archive, id); }
function softDelete(id) { stmts.softDelete.run(id); }
function getHistory(id) { return stmts.getHistory.all(id); }

module.exports = { enrich, findAll, findById, create, update, setArchived, softDelete, getHistory };
