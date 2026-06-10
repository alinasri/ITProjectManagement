const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');

function getOrCreateToken() {
  let row = db.prepare('SELECT token FROM report_tokens WHERE id = 1').get();
  if (!row) {
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare(`INSERT OR REPLACE INTO report_tokens (id, token, created_at) VALUES (1, ?, datetime('now'))`).run(token);
    row = { token };
  }
  return row.token;
}

// Get current token — admin or it_head
router.get('/token', requireAuth, requireRole('super_admin', 'it_head'), (req, res) => {
  const token = getOrCreateToken();
  res.json({ token });
});

// Regenerate token — admin only (invalidates old link)
router.post('/regenerate', requireAuth, requireRole('super_admin'), (req, res) => {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare(`INSERT OR REPLACE INTO report_tokens (id, token, created_at) VALUES (1, ?, datetime('now'))`).run(token);
  res.json({ token });
});

// Public report data — no auth, token in URL
router.get('/public/:token', (req, res) => {
  const row = db.prepare('SELECT token FROM report_tokens WHERE id = 1').get();
  if (!row || row.token !== req.params.token) {
    return res.status(404).json({ error: 'Not found' });
  }

  const sections  = db.prepare('SELECT * FROM sections ORDER BY name').all();
  const projects  = db.prepare('SELECT * FROM projects  WHERE is_archived = 0 AND is_deleted = 0').all();
  const tasks     = db.prepare('SELECT * FROM ongoing_tasks WHERE is_archived = 0 AND is_deleted = 0').all();
  const purchases = db.prepare('SELECT * FROM purchases WHERE is_archived = 0 AND is_deleted = 0').all();
  const tenders   = db.prepare('SELECT * FROM tenders   WHERE is_archived = 0 AND is_deleted = 0').all();
  const contracts = db.prepare('SELECT * FROM contracts  WHERE is_archived = 0 AND is_deleted = 0').all();

  res.json({ generated_at: new Date().toISOString(), sections, projects, tasks, purchases, tenders, contracts });
});

module.exports = router;
