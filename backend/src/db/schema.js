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
`);

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
