const db = require('./schema');

const _insertHistory = db.prepare(
  `INSERT INTO status_history (entity_type, entity_id, from_status, to_status, changed_by)
   VALUES (?, ?, ?, ?, ?)`
);

function recordStatusChange(entityType, entityId, fromStatus, toStatus, userId) {
  if (fromStatus === toStatus) return;
  try {
    _insertHistory.run(entityType, entityId, fromStatus ?? null, toStatus, userId ?? null);
  } catch (err) {
    console.error('[status_history] insert failed:', err.message);
  }
}

const _insertFieldChange = db.prepare(
  `INSERT INTO status_history (entity_type, entity_id, field, from_status, to_status, changed_by)
   VALUES (?, ?, ?, ?, ?, ?)`
);

function recordFieldChange(entityType, entityId, field, fromValue, toValue, userId) {
  if (fromValue === toValue) return;
  try {
    _insertFieldChange.run(entityType, entityId, field, fromValue ?? null, toValue ?? '', userId ?? null);
  } catch (err) {
    console.error('[status_history] field change insert failed:', err.message);
  }
}

module.exports = { recordStatusChange, recordFieldChange };
