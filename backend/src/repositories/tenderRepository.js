// repositories/tenderRepository.js — All SQL for the tenders table.
// Same multi-section pattern as purchaseRepository.

const db = require('../db/schema');

const stmts = {
  findBySection: db.prepare('SELECT DISTINCT t.* FROM tenders t JOIN tender_sections ts ON ts.tender_id = t.id WHERE ts.section_id = ? AND t.is_archived = ? AND t.is_deleted = 0 ORDER BY t.id'),
  findAll:       db.prepare('SELECT * FROM tenders WHERE is_archived = ? AND is_deleted = 0 ORDER BY id'),
  findById:      db.prepare('SELECT * FROM tenders WHERE id = ?'),
  create:        db.prepare('INSERT INTO tenders (title, status, estimated_amount, deadline, winner, description) VALUES (?, ?, ?, ?, ?, ?)'),
  update:        db.prepare("UPDATE tenders SET title = ?, status = ?, estimated_amount = ?, deadline = ?, winner = ?, description = ?, updated_at = datetime('now') WHERE id = ?"),
  setArchived:   db.prepare("UPDATE tenders SET is_archived = ?, updated_at = datetime('now') WHERE id = ?"),
  softDelete:    db.prepare('UPDATE tenders SET is_deleted = 1 WHERE id = ?'),
  sections:      db.prepare('SELECT s.id, s.name FROM tender_sections ts JOIN sections s ON s.id = ts.section_id WHERE ts.tender_id = ? ORDER BY s.name'),
  getHistory:    db.prepare("SELECT sh.*, u.username as changed_by_username FROM status_history sh LEFT JOIN users u ON u.id = sh.changed_by WHERE sh.entity_type = 'tender' AND sh.entity_id = ? ORDER BY sh.changed_at DESC"),
};

function enrich(rows) {
  return rows.map(r => ({ ...r, sections: stmts.sections.all(r.id) }));
}

function findAll({ sectionId, showArchived }) {
  if (sectionId) return stmts.findBySection.all(sectionId, showArchived);
  return stmts.findAll.all(showArchived);
}

function findById(id) { return stmts.findById.get(id); }

function create({ title, status, estimated_amount, deadline, winner, description }) {
  const result = stmts.create.run(title, status, estimated_amount, deadline, winner, description);
  return findById(result.lastInsertRowid);
}

function update(id, { title, status, estimated_amount, deadline, winner, description }) {
  stmts.update.run(title, status, estimated_amount, deadline, winner, description, id);
  return findById(id);
}

function setArchived(id, archive) { stmts.setArchived.run(archive, id); }
function softDelete(id) { stmts.softDelete.run(id); }
function getHistory(id) { return stmts.getHistory.all(id); }

module.exports = { enrich, findAll, findById, create, update, setArchived, softDelete, getHistory };
