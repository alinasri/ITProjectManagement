// repositories/customColumnRepository.js — All SQL for the custom_columns table.
//
// Custom columns are section-specific extra fields that appear on the projects table.
// Their values are stored separately in the custom_values table.

const db = require('../db/schema');

const stmts = {
  findAll:       db.prepare('SELECT * FROM custom_columns ORDER BY section_id, column_order'),
  findBySection: db.prepare('SELECT * FROM custom_columns WHERE section_id = ? ORDER BY column_order'),
  findById:      db.prepare('SELECT * FROM custom_columns WHERE id = ?'),
  // COALESCE(MAX(column_order), 0) returns 0 when no columns exist yet, so the first
  // column gets order 1. Adding 1 makes each new column appear after all existing ones.
  maxOrder:      db.prepare('SELECT COALESCE(MAX(column_order),0) as m FROM custom_columns WHERE section_id = ?'),
  create:        db.prepare('INSERT INTO custom_columns (section_id, column_name, column_order) VALUES (?, ?, ?)'),
  // ON DELETE CASCADE on custom_values means removing a column definition also removes
  // all stored values for that column across every project automatically.
  remove:        db.prepare('DELETE FROM custom_columns WHERE id = ?'),
};

function findAll() { return stmts.findAll.all(); }
function findBySection(sectionId) { return stmts.findBySection.all(sectionId); }
function findById(id) { return stmts.findById.get(id); }

function create({ sectionId, column_name }) {
  const maxOrder = stmts.maxOrder.get(sectionId).m;
  const result = stmts.create.run(sectionId, column_name, maxOrder + 1);
  return findById(result.lastInsertRowid);
}

function remove(id) { stmts.remove.run(id); }

module.exports = { findAll, findBySection, findById, create, remove };
