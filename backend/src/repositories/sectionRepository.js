// repositories/sectionRepository.js — All SQL for the sections table.

const db = require('../db/schema');

const stmts = {
  findAll:        db.prepare('SELECT * FROM sections ORDER BY id'),
  findById:       db.prepare('SELECT * FROM sections WHERE id = ?'),
  create:         db.prepare('INSERT INTO sections (name) VALUES (?)'),
  update:         db.prepare("UPDATE sections SET name = ?, updated_at = datetime('now') WHERE id = ?"),
  remove:         db.prepare('DELETE FROM sections WHERE id = ?'),
  // These three count() calls are used before deletion to block removal of non-empty sections.
  countProjects:  db.prepare('SELECT COUNT(*) as c FROM projects WHERE section_id = ?'),
  countTasks:     db.prepare('SELECT COUNT(*) as c FROM ongoing_tasks WHERE section_id = ?'),
  countPersonnel: db.prepare('SELECT COUNT(*) as c FROM personnel WHERE section_id = ?'),
};

function findAll() { return stmts.findAll.all(); }
function findById(id) { return stmts.findById.get(id); }

function create({ name }) {
  const result = stmts.create.run(name);
  return findById(result.lastInsertRowid);
}

function update(id, { name }) {
  stmts.update.run(name, id);
  return findById(id);
}

function remove(id) { stmts.remove.run(id); }

// countRelatedData — returns the total number of records that reference this section.
// Used by sectionService to block deletion when data exists.
function countRelatedData(id) {
  return stmts.countProjects.get(id).c
       + stmts.countTasks.get(id).c
       + stmts.countPersonnel.get(id).c;
}

module.exports = { findAll, findById, create, update, remove, countRelatedData };
