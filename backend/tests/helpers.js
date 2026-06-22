// tests/helpers.js — Shared setup utilities used by every test file.
// Keeps the per-file setup code small and consistent.

const os = require('os');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// setupTestApp — creates a completely isolated environment for one test file.
//
// WHY isolation matters: if all test files shared one database, tests would
// interfere with each other (leftover rows, conflicting usernames, etc.).
// Each file calls this in its own beforeAll(), getting its own private database.
//
// HOW it works:
//   1. jest.resetModules() clears Node's require() cache so the next require()
//      call re-executes each module from scratch instead of returning the cached
//      instance. Without this, all test files would share the same db connection.
//   2. A temporary directory is created in the OS temp folder (e.g. /tmp/it-pm-test-abc/)
//      so the database file never collides with the real one or another test file's.
//   3. Setting process.env.DATA_DIR before requiring schema.js points the database
//      to that temp directory.
//
// Returns: { app, db, jwt, JWT_SECRET } — everything a test file needs.
function setupTestApp() {
  jest.resetModules();

  // os.tmpdir(): the OS temporary directory (/tmp on Linux/Mac, %TEMP% on Windows).
  // fs.mkdtempSync(): creates a new uniquely-named subdirectory and returns its path.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'it-pm-test-'));
  process.env.DATA_DIR = tmpDir;

  // These require() calls now run fresh because we reset the module cache above.
  // db/schema.js will create a brand-new SQLite database in tmpDir.
  const app = require('../src/app');
  const db = require('../src/db/schema');
  const { JWT_SECRET } = require('../src/middleware/auth');
  const jwt = require('jsonwebtoken');

  return { app, db, jwt, JWT_SECRET };
}

// seedUser — inserts a user directly into the database and returns their new id.
//
// WHY direct DB insert instead of POST /api/users:
//   Tests that test the login or auth flows need users to already exist in the
//   database before the test runs. Using the API would require an admin token,
//   creating a circular dependency. Direct insertion bypasses that.
//
// WHY bcrypt cost factor 1 (not the default 10):
//   bcrypt is intentionally slow to thwart brute-force attacks. Cost 10 takes
//   ~100ms per hash. In a test suite that creates dozens of users, that adds up.
//   Cost 1 is fast enough for tests where security is irrelevant.
function seedUser(db, { username, password = 'testpass123', role, section_id = null }) {
  const hash = bcrypt.hashSync(password, 1);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, role, section_id) VALUES (?, ?, ?, ?)'
  ).run(username, hash, role, section_id);
  return result.lastInsertRowid;
}

// makeToken — signs a JWT token for a given user payload.
//
// WHY use this instead of POST /api/auth/login in most tests:
//   Most tests are not testing the login flow — they are testing something that
//   requires an authenticated user. Going through the login endpoint every time
//   is slow and couples unrelated tests to the auth code. makeToken creates a
//   valid token directly, skipping the HTTP round-trip.
//
// The token is signed with the same JWT_SECRET the app uses, so requireAuth
// in middleware/auth.js will accept it as genuine.
function makeToken(jwt, JWT_SECRET, { id, username, role, section_id = null }) {
  return jwt.sign({ id, username, role, section_id }, JWT_SECRET);
}

module.exports = { setupTestApp, seedUser, makeToken };
