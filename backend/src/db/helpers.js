// db/helpers.js — Reusable database operations shared across multiple route files.
// Centralizing these patterns prevents copy-pasting the same SQL logic in five places.

const db = require('./schema');

// Pre-compile this INSERT statement once at module load time (not inside a function).
// Prepared statements are faster (SQLite parses the SQL only once) and prevent SQL
// injection by keeping query structure and data values separate.
const _insertHistory = db.prepare(
  `INSERT INTO status_history (entity_type, entity_id, from_status, to_status, changed_by)
   VALUES (?, ?, ?, ?, ?)`
);

// recordStatusChange — writes an audit trail entry when an entity's status changes.
// Called every time a project, task, purchase, tender, or contract changes status.
// Skips silently if fromStatus === toStatus to avoid recording no-op changes.
//
// entityType: 'project' | 'ongoing_task' | 'purchase' | 'tender' | 'contract'
// fromStatus: the old status value (null on creation — the entity had no previous status)
// userId: the ID of the user who made the change (null if done programmatically)
function recordStatusChange(entityType, entityId, fromStatus, toStatus, userId) {
  if (fromStatus === toStatus) return;
  try {
    // ?? (nullish coalescing) converts undefined to null; SQLite understands null but not undefined.
    _insertHistory.run(entityType, entityId, fromStatus ?? null, toStatus, userId ?? null);
  } catch (err) {
    console.error('[status_history] insert failed:', err.message);
  }
}

const _insertFieldChange = db.prepare(
  `INSERT INTO status_history (entity_type, entity_id, field, from_status, to_status, changed_by)
   VALUES (?, ?, ?, ?, ?, ?)`
);

// recordFieldChange — like recordStatusChange but for specific named fields (e.g. due_date).
// Reuses the status_history table; the `field` column distinguishes these rows from
// pure status changes. Skips if the value did not actually change.
function recordFieldChange(entityType, entityId, field, fromValue, toValue, userId) {
  if (fromValue === toValue) return;
  try {
    _insertFieldChange.run(entityType, entityId, field, fromValue ?? null, toValue ?? '', userId ?? null);
  } catch (err) {
    console.error('[status_history] field change insert failed:', err.message);
  }
}

// setResponsibles — replaces the complete list of people responsible for a project or task.
// Strategy: delete all existing rows for this entity, then re-insert the new list.
// This "delete-and-re-insert" is simpler than computing a diff between old and new, and
// handles any combination of additions and removals in a single operation.
//
// table:        'project_responsibles' | 'ongoing_task_responsibles'
// fk:           the foreign key column name in that table ('project_id' or 'task_id')
// id:           the entity's ID
// personnelIds: array of personnel IDs that should be assigned after this call
function setResponsibles(table, fk, id, personnelIds) {
  db.prepare(`DELETE FROM ${table} WHERE ${fk} = ?`).run(id);
  const insert = db.prepare(`INSERT INTO ${table} (${fk}, personnel_id) VALUES (?, ?)`);
  personnelIds.forEach(pid => insert.run(id, pid));
}

// setSections — replaces the complete list of sections linked to a purchase, tender, or contract.
// Same delete-and-re-insert strategy as setResponsibles.
//
// table:      'purchase_sections' | 'tender_sections' | 'contract_sections'
// fkCol:      the foreign key column name in that table
// id:         the entity's ID
// sectionIds: array of section IDs that should be linked after this call
function setSections(table, fkCol, id, sectionIds) {
  db.prepare(`DELETE FROM ${table} WHERE ${fkCol} = ?`).run(id);
  const insert = db.prepare(`INSERT INTO ${table} (${fkCol}, section_id) VALUES (?, ?)`);
  sectionIds.forEach(sid => insert.run(id, sid));
}

module.exports = { recordStatusChange, recordFieldChange, setResponsibles, setSections };
