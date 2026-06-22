// routes/contracts.js — Full CRUD for contracts.
// Same multi-section pattern as purchases.js and tenders.js.
// Mounted at /api/contracts in app.js.

const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recordStatusChange, setSections } = require('../db/helpers');

const router = express.Router();

// enrichContracts — attaches the sections array to each raw contract row.
// JOINs through contract_sections to get the full section objects for each contract.
function enrichContracts(rows) {
  return rows.map(r => {
    const sections = db.prepare(
      `SELECT s.id, s.name FROM contract_sections cs
       JOIN sections s ON s.id = cs.section_id
       WHERE cs.contract_id = ? ORDER BY s.name`
    ).all(r.id);
    return { ...r, sections };
  });
}


// GET /api/contracts — lists contracts with role-based section filtering.
// contract_admin and it_head can see all; section_head sees only their section's contracts.
router.get('/', requireAuth, requireRole('super_admin', 'it_head', 'contract_admin', 'section_head'), (req, res) => {
  const showArchived = req.query.archived === '1' ? 1 : 0;
  const filterSection = req.user.role === 'section_head' ? req.user.section_id : req.query.section_id;
  let rows;
  if (filterSection) {
    // JOIN is required because the section link lives in the contract_sections join table.
    rows = db.prepare(
      `SELECT DISTINCT c.* FROM contracts c
       JOIN contract_sections cs ON cs.contract_id = c.id
       WHERE cs.section_id = ? AND c.is_archived = ? AND c.is_deleted = 0 ORDER BY c.id`
    ).all(filterSection, showArchived);
  } else {
    rows = db.prepare('SELECT * FROM contracts WHERE is_archived = ? AND is_deleted = 0 ORDER BY id').all(showArchived);
  }
  res.json(enrichContracts(rows));
});

// POST /api/contracts — creates a new contract. super_admin or contract_admin only.
router.post('/', requireAuth, requireRole('super_admin', 'contract_admin'), (req, res) => {
  const { title, status, counterparty, start_date, end_date, amount, description, section_ids } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

  const initialStatus = status || 'active';
  const result = db.prepare(
    `INSERT INTO contracts (title, status, counterparty, start_date, end_date, amount, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    title.trim(), initialStatus, counterparty || '', start_date || '', end_date || '', amount || '', description || ''
  );
  const id = result.lastInsertRowid;
  recordStatusChange('contract', id, null, initialStatus, req.user.id);
  if (Array.isArray(section_ids)) setSections('contract_sections', 'contract_id', id, section_ids);
  const row = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id);
  res.status(201).json(enrichContracts([row])[0]);
});

// GET /api/contracts/:id/history — returns the status change log for one contract.
router.get('/:id/history', requireAuth, requireRole('super_admin', 'it_head', 'contract_admin'), (req, res) => {
  const rows = db.prepare(
    `SELECT sh.*, u.username as changed_by_username
     FROM status_history sh
     LEFT JOIN users u ON u.id = sh.changed_by
     WHERE sh.entity_type = 'contract' AND sh.entity_id = ?
     ORDER BY sh.changed_at DESC`
  ).all(req.params.id);
  res.json(rows);
});

// PUT /api/contracts/:id — full update of a contract.
router.put('/:id', requireAuth, requireRole('super_admin', 'contract_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const { title, status, counterparty, start_date, end_date, amount, description, section_ids } = req.body;
  const newStatus = status ?? row.status;
  db.prepare(
    `UPDATE contracts SET title = ?, status = ?, counterparty = ?, start_date = ?, end_date = ?, amount = ?, description = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    title ?? row.title,
    newStatus,
    counterparty ?? row.counterparty,
    start_date ?? row.start_date,
    end_date ?? row.end_date,
    amount ?? row.amount,
    description ?? row.description,
    req.params.id
  );
  recordStatusChange('contract', req.params.id, row.status, newStatus, req.user.id);

  if (Array.isArray(section_ids)) setSections('contract_sections', 'contract_id', req.params.id, section_ids);

  res.json(enrichContracts([db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id)])[0]);
});

// PATCH /api/contracts/:id/archive — archives or unarchives a contract.
router.patch('/:id/archive', requireAuth, requireRole('super_admin', 'contract_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const archive = req.body.archive === false ? 0 : 1;
  db.prepare(`UPDATE contracts SET is_archived = ?, updated_at = datetime('now') WHERE id = ?`).run(archive, req.params.id);
  res.json({ ok: true, is_archived: archive });
});

// DELETE /api/contracts/:id — soft-deletes a contract within the 10-minute window.
router.delete('/:id', requireAuth, requireRole('super_admin', 'contract_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const ageMs = Date.now() - new Date(row.created_at + 'Z').getTime();
  if (ageMs > 10 * 60 * 1000) {
    return res.status(409).json({ error: 'older_than_10_min' });
  }
  db.prepare('UPDATE contracts SET is_deleted = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
