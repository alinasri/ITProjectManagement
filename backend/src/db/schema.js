const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'it_pm.db'));

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('super_admin','it_head','section_head')),
    section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
    must_change_password INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS personnel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    responsible_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'not_started'
      CHECK(status IN ('not_started','in_progress','on_hold','completed')),
    future_plan TEXT DEFAULT '',
    problems TEXT DEFAULT '',
    row_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS custom_columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    column_name TEXT NOT NULL,
    column_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS custom_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    column_id INTEGER NOT NULL REFERENCES custom_columns(id) ON DELETE CASCADE,
    value TEXT DEFAULT '',
    UNIQUE(project_id, column_id)
  );

  CREATE TABLE IF NOT EXISTS ongoing_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    responsible_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS project_responsibles (
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, personnel_id)
  );

  CREATE TABLE IF NOT EXISTS ongoing_task_responsibles (
    task_id INTEGER NOT NULL REFERENCES ongoing_tasks(id) ON DELETE CASCADE,
    personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, personnel_id)
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','approved','purchased','delivered','cancelled')),
    supplier TEXT DEFAULT '',
    amount TEXT DEFAULT '',
    purchase_date TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS purchase_sections (
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    PRIMARY KEY (purchase_id, section_id)
  );

  CREATE TABLE IF NOT EXISTS tenders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open'
      CHECK(status IN ('open','evaluating','awarded','completed','cancelled')),
    estimated_amount TEXT DEFAULT '',
    deadline TEXT DEFAULT '',
    winner TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tender_sections (
    tender_id INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    PRIMARY KEY (tender_id, section_id)
  );

  CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
      CHECK(status IN ('active','renewed','expired','cancelled')),
    counterparty TEXT DEFAULT '',
    start_date TEXT DEFAULT '',
    end_date TEXT DEFAULT '',
    amount TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contract_sections (
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    PRIMARY KEY (contract_id, section_id)
  );
`);

// Migrate single responsible_id columns to many-to-many join tables
// (projects/ongoing_tasks can each have more than one مسئول)
for (const [table, joinTable, fk] of [
  ['projects', 'project_responsibles', 'project_id'],
  ['ongoing_tasks', 'ongoing_task_responsibles', 'task_id'],
]) {
  const hasResponsibleId = db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === 'responsible_id');
  if (hasResponsibleId) {
    db.exec(`INSERT OR IGNORE INTO ${joinTable} (${fk}, personnel_id)
             SELECT id, responsible_id FROM ${table} WHERE responsible_id IS NOT NULL`);
    db.exec(`ALTER TABLE ${table} DROP COLUMN responsible_id`);
  }
}

// Migrate users.role CHECK constraint to allow the new registry-admin roles
// (SQLite can't ALTER a CHECK constraint in place — recreate the table)
const usersTableSql = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get().sql;
if (!usersTableSql.includes('purchase_admin')) {
  db.exec(`
    CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('super_admin','it_head','section_head','purchase_admin','tender_admin','contract_admin')),
      section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
      must_change_password INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO users_new (id, username, password_hash, role, section_id, must_change_password, created_at)
      SELECT id, username, password_hash, role, section_id, must_change_password, created_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
  `);
}

// Seed initial data only once
const existing = db.prepare('SELECT COUNT(*) as c FROM sections').get();
if (existing.c === 0) {
  const insertSection = db.prepare('INSERT INTO sections (name) VALUES (?)');
  [
    'تحول دیجیتال و مدیریت داده‌ها',
    'شبکه و امنیت',
    'پشتیبانی',
    'ساماندهی اطلاعات اکتشافی',
    'طراحی و توسعه',
  ].forEach(name => insertSection.run(name));

  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    `INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?, ?, 'super_admin', 1)`
  ).run('admin', hash);
}

module.exports = db;
