// repositories/contractRepository.js — All SQL for the contracts table.
// Same multi-section pattern as purchaseRepository.

const db = require('../db/schema');

const stmts = {
  findBySection: db.prepare('SELECT DISTINCT c.* FROM contracts c JOIN contract_sections cs ON cs.contract_id = c.id WHERE cs.section_id = ? AND c.is_archived = ? AND c.is_deleted = 0 ORDER BY c.id'),
  findAll:       db.prepare('SELECT * FROM contracts WHERE is_archived = ? AND is_deleted = 0 ORDER BY id'),
  findById:      db.prepare('SELECT * FROM contracts WHERE id = ?'),
  create:        db.prepare('INSERT INTO contracts (title, status, counterparty, start_date, end_date, amount, description) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  update:        db.prepare("UPDATE contracts SET title = ?, status = ?, counterparty = ?, start_date = ?, end_date = ?, amount = ?, description = ?, updated_at = datetime('now') WHERE id = ?"),
  setArchived:   db.prepare("UPDATE contracts SET is_archived = ?, updated_at = datetime('now') WHERE id = ?"),
  softDelete:    db.prepare('UPDATE contracts SET is_deleted = 1 WHERE id = ?'),
  sections:      db.prepare('SELECT s.id, s.name FROM contract_sections cs JOIN sections s ON s.id = cs.section_id WHERE cs.contract_id = ? ORDER BY s.name'),
  getHistory:    db.prepare("SELECT sh.*, u.username as changed_by_username FROM status_history sh LEFT JOIN users u ON u.id = sh.changed_by WHERE sh.entity_type = 'contract' AND sh.entity_id = ? ORDER BY sh.changed_at DESC"),
};

function enrich(rows) {
  return rows.map(r => ({ ...r, sections: stmts.sections.all(r.id) }));
}

function findAll({ sectionId, showArchived }) {
  if (sectionId) return stmts.findBySection.all(sectionId, showArchived);
  return stmts.findAll.all(showArchived);
}

function findById(id) { return stmts.findById.get(id); }

function create({ title, status, counterparty, start_date, end_date, amount, description }) {
  const result = stmts.create.run(title, status, counterparty, start_date, end_date, amount, description);
  return findById(result.lastInsertRowid);
}

function update(id, { title, status, counterparty, start_date, end_date, amount, description }) {
  stmts.update.run(title, status, counterparty, start_date, end_date, amount, description, id);
  return findById(id);
}

function setArchived(id, archive) { stmts.setArchived.run(archive, id); }
function softDelete(id) { stmts.softDelete.run(id); }
function getHistory(id) { return stmts.getHistory.all(id); }

module.exports = { enrich, findAll, findById, create, update, setArchived, softDelete, getHistory };
