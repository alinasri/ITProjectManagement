// repositories/personnelRepository.js — All SQL for the personnel table.

const db = require('../db/schema');

const stmts = {
  findAll:       db.prepare('SELECT * FROM personnel ORDER BY section_id, name'),
  findBySection: db.prepare('SELECT * FROM personnel WHERE section_id = ? ORDER BY name'),
  findById:      db.prepare('SELECT * FROM personnel WHERE id = ?'),
  create:        db.prepare('INSERT INTO personnel (name, section_id) VALUES (?, ?)'),
  // ON DELETE CASCADE on project_responsibles / ongoing_task_responsibles means SQLite
  // automatically removes all assignments for this person when they are deleted here.
  remove:        db.prepare('DELETE FROM personnel WHERE id = ?'),
};

function findAll() { return stmts.findAll.all(); }
function findBySection(sectionId) { return stmts.findBySection.all(sectionId); }
function findById(id) { return stmts.findById.get(id); }

function create({ name, sectionId }) {
  const result = stmts.create.run(name, sectionId);
  return findById(result.lastInsertRowid);
}

function remove(id) { stmts.remove.run(id); }

module.exports = { findAll, findBySection, findById, create, remove };
