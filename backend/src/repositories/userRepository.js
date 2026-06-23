// repositories/userRepository.js — All SQL for the users table.
//
// Two find-by-id variants:
//   findById()       — returns ALL columns including password_hash (needed for auth checks)
//   findPublicById() — returns only safe-to-expose columns (used in responses)

const db = require('../db/schema');

const stmts = {
  findAll:          db.prepare('SELECT id, username, role, section_id, must_change_password, created_at, is_active FROM users WHERE is_deleted = 0 ORDER BY id'),
  findById:         db.prepare('SELECT * FROM users WHERE id = ?'),
  findPublicById:   db.prepare('SELECT id, username, role, section_id, must_change_password FROM users WHERE id = ?'),
  findByUsername:   db.prepare('SELECT * FROM users WHERE username = ?'),
  usernameExists:   db.prepare('SELECT id FROM users WHERE username = ?'),
  create:           db.prepare('INSERT INTO users (username, password_hash, role, section_id, must_change_password) VALUES (?, ?, ?, ?, 1)'),
  update:           db.prepare('UPDATE users SET username = ?, password_hash = ?, role = ?, section_id = ? WHERE id = ?'),
  toggleActive:     db.prepare('UPDATE users SET is_active = ? WHERE id = ?'),
  softDelete:       db.prepare('UPDATE users SET is_deleted = 1 WHERE id = ?'),
  // must_change_password is cleared to 0 after a successful forced password change.
  updatePassword:   db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?'),
};

function findAll() { return stmts.findAll.all(); }
function findById(id) { return stmts.findById.get(id); }
function findPublicById(id) { return stmts.findPublicById.get(id); }
function findByUsername(username) { return stmts.findByUsername.get(username); }
function existsByUsername(username) { return !!stmts.usernameExists.get(username); }

function create({ username, hash, role, section_id }) {
  const result = stmts.create.run(username, hash, role, section_id || null);
  return findPublicById(result.lastInsertRowid);
}

function update(id, { username, hash, role, section_id }) {
  stmts.update.run(username, hash, role, section_id, id);
  return findPublicById(id);
}

function toggleActive(id, newActive) { stmts.toggleActive.run(newActive, id); }
function softDelete(id) { stmts.softDelete.run(id); }
function updatePassword(id, hash) { stmts.updatePassword.run(hash, id); }

module.exports = { findAll, findById, findPublicById, findByUsername, existsByUsername, create, update, toggleActive, softDelete, updatePassword };
