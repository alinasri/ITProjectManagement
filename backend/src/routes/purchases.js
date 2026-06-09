const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recordStatusChange } = require('../db/helpers');

const router = express.Router();

function enrichPurchases(rows) {
  return rows.map(r => {
    const sections = db.prepare(
      `SELECT s.id, s.name FROM purchase_sections ps
       JOIN sections s ON s.id = ps.section_id
       WHERE ps.purchase_id = ? ORDER BY s.name`
    ).all(r.id);
    return { ...r, sections };
  });
}

function setSections(id, sectionIds) {
  db.prepare('DELETE FROM purchase_sections WHERE purchase_id = ?').run(id);
  const insert = db.prepare('INSERT INTO purchase_sections (purchase_id, section_id) VALUES (?, ?)');
  sectionIds.forEach(sid => insert.run(id, sid));
}

router.get('/', requireAuth, requireRole('super_admin', 'it_head', 'purchase_admin'), (req, res) => {
  const showArchived = req.query.archived === '1' ? 1 : 0;
  const rows = db.prepare('SELECT * FROM purchases WHERE is_archived = ? AND is_deleted = 0 ORDER BY id').all(showArchived);
  res.json(enrichPurchases(rows));
});

router.post('/', requireAuth, requireRole('super_admin', 'purchase_admin'), (req, res) => {
  const { title, status, supplier, amount, purchase_date, description, section_ids } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

  const initialStatus = status || 'pending';
  const result = db.prepare(
    `INSERT INTO purchases (title, status, supplier, amount, purchase_date, description)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    title.trim(), initialStatus, supplier || '', amount || '', purchase_date || '', description || ''
  );
  const id = result.lastInsertRowid;
  recordStatusChange('purchase', id, null, initialStatus, req.user.id);
  if (Array.isArray(section_ids)) setSections(id, section_ids);
  const row = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
  res.status(201).json(enrichPurchases([row])[0]);
});

router.get('/:id/history', requireAuth, requireRole('super_admin', 'it_head', 'purchase_admin'), (req, res) => {
  const rows = db.prepare(
    `SELECT sh.*, u.username as changed_by_username
     FROM status_history sh
     LEFT JOIN users u ON u.id = sh.changed_by
     WHERE sh.entity_type = 'purchase' AND sh.entity_id = ?
     ORDER BY sh.changed_at DESC`
  ).all(req.params.id);
  res.json(rows);
});

router.put('/:id', requireAuth, requireRole('super_admin', 'purchase_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const { title, status, supplier, amount, purchase_date, description, section_ids } = req.body;
  const newStatus = status ?? row.status;
  db.prepare(
    `UPDATE purchases SET title = ?, status = ?, supplier = ?, amount = ?, purchase_date = ?, description = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    title ?? row.title,
    newStatus,
    supplier ?? row.supplier,
    amount ?? row.amount,
    purchase_date ?? row.purchase_date,
    description ?? row.description,
    req.params.id
  );
  recordStatusChange('purchase', req.params.id, row.status, newStatus, req.user.id);

  if (Array.isArray(section_ids)) setSections(req.params.id, section_ids);

  res.json(enrichPurchases([db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id)])[0]);
});

router.patch('/:id/archive', requireAuth, requireRole('super_admin', 'purchase_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const archive = req.body.archive === false ? 0 : 1;
  db.prepare(`UPDATE purchases SET is_archived = ?, updated_at = datetime('now') WHERE id = ?`).run(archive, req.params.id);
  res.json({ ok: true, is_archived: archive });
});

router.delete('/:id', requireAuth, requireRole('super_admin', 'purchase_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const ageMs = Date.now() - new Date(row.created_at + 'Z').getTime();
  if (ageMs > 10 * 60 * 1000) {
    return res.status(409).json({ error: 'older_than_10_min' });
  }
  db.prepare('UPDATE purchases SET is_deleted = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
