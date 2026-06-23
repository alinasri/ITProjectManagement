// repositories/reportRepository.js — SQL for the public report feature.
//
// The report has two parts:
//   1. report_tokens table: stores the single shared token used to authenticate public access.
//   2. Full data dump: a snapshot of all active records across all entity tables.

const db = require('../db/schema');

const stmts = {
  getToken:  db.prepare('SELECT token FROM report_tokens WHERE id = 1'),
  // INSERT OR REPLACE: if a row with id = 1 already exists, replace it (i.e. rotate the token).
  setToken:  db.prepare("INSERT OR REPLACE INTO report_tokens (id, token, created_at) VALUES (1, ?, datetime('now'))"),
  sections:  db.prepare('SELECT * FROM sections ORDER BY name'),
  projects:  db.prepare('SELECT * FROM projects WHERE is_archived = 0 AND is_deleted = 0'),
  tasks:     db.prepare('SELECT * FROM ongoing_tasks WHERE is_archived = 0 AND is_deleted = 0'),
  purchases: db.prepare('SELECT * FROM purchases WHERE is_archived = 0 AND is_deleted = 0'),
  tenders:   db.prepare('SELECT * FROM tenders WHERE is_archived = 0 AND is_deleted = 0'),
  contracts: db.prepare('SELECT * FROM contracts WHERE is_archived = 0 AND is_deleted = 0'),
};

// getToken — returns the stored token string, or null if no token has been created yet.
function getToken() {
  const row = stmts.getToken.get();
  return row ? row.token : null;
}

function setToken(token) {
  stmts.setToken.run(token);
}

// getAllData — returns a flat snapshot of all active records for the public report.
function getAllData() {
  return {
    sections:  stmts.sections.all(),
    projects:  stmts.projects.all(),
    tasks:     stmts.tasks.all(),
    purchases: stmts.purchases.all(),
    tenders:   stmts.tenders.all(),
    contracts: stmts.contracts.all(),
  };
}

module.exports = { getToken, setToken, getAllData };
