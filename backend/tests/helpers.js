const os = require('os');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Resets the module cache and creates a fresh isolated SQLite database in a
// temp directory. Returns the Express app, the db instance, and JWT utilities.
// Call this inside beforeAll() so each test file gets its own clean database.
function setupTestApp() {
  jest.resetModules();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'it-pm-test-'));
  process.env.DATA_DIR = tmpDir;

  const app = require('../src/app');
  const db = require('../src/db/schema');
  const { JWT_SECRET } = require('../src/middleware/auth');
  const jwt = require('jsonwebtoken');

  return { app, db, jwt, JWT_SECRET };
}

// Inserts a user into the database and returns their new id.
// Uses bcrypt cost factor 1 (instead of the default 10) so tests run fast.
function seedUser(db, { username, password = 'testpass123', role, section_id = null }) {
  const hash = bcrypt.hashSync(password, 1);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, role, section_id) VALUES (?, ?, ?, ?)'
  ).run(username, hash, role, section_id);
  return result.lastInsertRowid;
}

// Signs a JWT token for a given user object. Used to authenticate requests in
// tests without going through the login endpoint every time.
function makeToken(jwt, JWT_SECRET, { id, username, role, section_id = null }) {
  return jwt.sign({ id, username, role, section_id }, JWT_SECRET);
}

module.exports = { setupTestApp, seedUser, makeToken };
