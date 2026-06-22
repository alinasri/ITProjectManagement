// routes/report.js — Public shareable report for stakeholders who don't have a login.
// Access is controlled by a random URL token rather than a user account.
// Mounted at /api/report in app.js.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');

// getOrCreateToken — returns the current report token, creating one if none exists.
// There is always exactly one token in the report_tokens table (id = 1).
// The token is embedded in the shareable URL; knowing it is the only "auth" needed.
function getOrCreateToken() {
  let row = db.prepare('SELECT token FROM report_tokens WHERE id = 1').get();
  if (!row) {
    // crypto.randomBytes(24) generates 24 cryptographically random bytes.
    // .toString('hex') converts them to a 48-character hex string — effectively unguessable.
    const token = crypto.randomBytes(24).toString('hex');
    // INSERT OR REPLACE: if a row with id = 1 exists, replace it; otherwise insert.
    db.prepare(`INSERT OR REPLACE INTO report_tokens (id, token, created_at) VALUES (1, ?, datetime('now'))`).run(token);
    row = { token };
  }
  return row.token;
}

// GET /api/report/token — returns the current token to admins so they can share the URL.
// super_admin or it_head only (read-only access to the token).
router.get('/token', requireAuth, requireRole('super_admin', 'it_head'), (req, res) => {
  const token = getOrCreateToken();
  res.json({ token });
});

// POST /api/report/regenerate — generates a new token, invalidating all existing shared links.
// super_admin only (it_head can view the token but not regenerate it).
router.post('/regenerate', requireAuth, requireRole('super_admin'), (req, res) => {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare(`INSERT OR REPLACE INTO report_tokens (id, token, created_at) VALUES (1, ?, datetime('now'))`).run(token);
  res.json({ token });
});

// GET /api/report/public/:token — returns a full data snapshot with NO authentication.
// This route is intentionally public — the token in the URL is the only access control.
// Anyone with the URL can read this data; regenerating the token revokes existing links.
router.get('/public/:token', (req, res) => {
  // Validate that the token in the URL matches the stored one.
  const row = db.prepare('SELECT token FROM report_tokens WHERE id = 1').get();
  if (!row || row.token !== req.params.token) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Return a complete snapshot of all active (non-archived, non-deleted) data.
  // This is intentionally a flat dump — no enrichment — to keep the response fast.
  const sections  = db.prepare('SELECT * FROM sections ORDER BY name').all();
  const projects  = db.prepare('SELECT * FROM projects  WHERE is_archived = 0 AND is_deleted = 0').all();
  const tasks     = db.prepare('SELECT * FROM ongoing_tasks WHERE is_archived = 0 AND is_deleted = 0').all();
  const purchases = db.prepare('SELECT * FROM purchases WHERE is_archived = 0 AND is_deleted = 0').all();
  const tenders   = db.prepare('SELECT * FROM tenders   WHERE is_archived = 0 AND is_deleted = 0').all();
  const contracts = db.prepare('SELECT * FROM contracts  WHERE is_archived = 0 AND is_deleted = 0').all();

  // generated_at gives consumers a timestamp so they know how fresh the data is.
  res.json({ generated_at: new Date().toISOString(), sections, projects, tasks, purchases, tenders, contracts });
});

module.exports = router;
