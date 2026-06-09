const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recordStatusChange } = require('../db/helpers');

const router = express.Router();

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

function setSections(id, sectionIds) {
  db.prepare('DELETE FROM contract_sections WHERE contract_id = ?').run(id);
  const insert = db.prepare('INSERT INTO contract_sections (contract_id, section_id) VALUES (?, ?)');
  sectionIds.forEach(sid => insert.run(id, sid));
}

router.get('/', requireAuth, requireRole('super_admin', 'it_head', 'contract_admin'), (req, res) => {
  const showArchived = req.query.archived === '1' ? 1 : 0;
  const rows = db.prepare('SELECT * FROM contracts WHERE is_archived = ? AND is_deleted = 0 ORDER BY id').all(showArchived);
  res.json(enrichContracts(rows));
});

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
  if (Array.isArray(section_ids)) setSections(id, section_ids);
  const row = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id);
  res.status(201).json(enrichContracts([row])[0]);
});

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

  if (Array.isArray(section_ids)) setSections(req.params.id, section_ids);

  res.json(enrichContracts([db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id)])[0]);
});

router.patch('/:id/archive', requireAuth, requireRole('super_admin', 'contract_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const archive = req.body.archive === false ? 0 : 1;
  db.prepare(`UPDATE contracts SET is_archived = ?, updated_at = datetime('now') WHERE id = ?`).run(archive, req.params.id);
  res.json({ ok: true, is_archived: archive });
});

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
