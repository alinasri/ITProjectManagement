// repositories/purchaseRepository.js — All SQL for the purchases table.
//
// Purchases differ from projects: they can belong to multiple sections via the
// purchase_sections join table. enrich() attaches the sections array to each row.

const db = require('../db/schema');

const stmts = {
  // DISTINCT prevents duplicate rows if a purchase is matched via multiple sections.
  findBySection: db.prepare('SELECT DISTINCT p.* FROM purchases p JOIN purchase_sections ps ON ps.purchase_id = p.id WHERE ps.section_id = ? AND p.is_archived = ? AND p.is_deleted = 0 ORDER BY p.id'),
  findAll:       db.prepare('SELECT * FROM purchases WHERE is_archived = ? AND is_deleted = 0 ORDER BY id'),
  findById:      db.prepare('SELECT * FROM purchases WHERE id = ?'),
  create:        db.prepare('INSERT INTO purchases (title, status, supplier, amount, purchase_date, description) VALUES (?, ?, ?, ?, ?, ?)'),
  update:        db.prepare("UPDATE purchases SET title = ?, status = ?, supplier = ?, amount = ?, purchase_date = ?, description = ?, updated_at = datetime('now') WHERE id = ?"),
  setArchived:   db.prepare("UPDATE purchases SET is_archived = ?, updated_at = datetime('now') WHERE id = ?"),
  softDelete:    db.prepare('UPDATE purchases SET is_deleted = 1 WHERE id = ?'),
  sections:      db.prepare('SELECT s.id, s.name FROM purchase_sections ps JOIN sections s ON s.id = ps.section_id WHERE ps.purchase_id = ? ORDER BY s.name'),
  getHistory:    db.prepare("SELECT sh.*, u.username as changed_by_username FROM status_history sh LEFT JOIN users u ON u.id = sh.changed_by WHERE sh.entity_type = 'purchase' AND sh.entity_id = ? ORDER BY sh.changed_at DESC"),
};

// enrich — attaches the sections array to each plain purchase row.
function enrich(rows) {
  return rows.map(r => ({ ...r, sections: stmts.sections.all(r.id) }));
}

function findAll({ sectionId, showArchived }) {
  if (sectionId) return stmts.findBySection.all(sectionId, showArchived);
  return stmts.findAll.all(showArchived);
}

function findById(id) { return stmts.findById.get(id); }

function create({ title, status, supplier, amount, purchase_date, description }) {
  const result = stmts.create.run(title, status, supplier, amount, purchase_date, description);
  return findById(result.lastInsertRowid);
}

function update(id, { title, status, supplier, amount, purchase_date, description }) {
  stmts.update.run(title, status, supplier, amount, purchase_date, description, id);
  return findById(id);
}

function setArchived(id, archive) { stmts.setArchived.run(archive, id); }
function softDelete(id) { stmts.softDelete.run(id); }
function getHistory(id) { return stmts.getHistory.all(id); }

module.exports = { enrich, findAll, findById, create, update, setArchived, softDelete, getHistory };
