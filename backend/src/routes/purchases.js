const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');

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
  const rows = db.prepare('SELECT * FROM purchases ORDER BY id').all();
  res.json(enrichPurchases(rows));
});

router.post('/', requireAuth, requireRole('super_admin', 'purchase_admin'), (req, res) => {
  const { title, status, supplier, amount, purchase_date, description, section_ids } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

  const result = db.prepare(
    `INSERT INTO purchases (title, status, supplier, amount, purchase_date, description)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    title.trim(), status || 'pending', supplier || '', amount || '', purchase_date || '', description || ''
  );
  const id = result.lastInsertRowid;
  if (Array.isArray(section_ids)) setSections(id, section_ids);
  const row = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
  res.status(201).json(enrichPurchases([row])[0]);
});

router.put('/:id', requireAuth, requireRole('super_admin', 'purchase_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const { title, status, supplier, amount, purchase_date, description, section_ids } = req.body;
  db.prepare(
    `UPDATE purchases SET title = ?, status = ?, supplier = ?, amount = ?, purchase_date = ?, description = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    title ?? row.title,
    status ?? row.status,
    supplier ?? row.supplier,
    amount ?? row.amount,
    purchase_date ?? row.purchase_date,
    description ?? row.description,
    req.params.id
  );

  if (Array.isArray(section_ids)) setSections(req.params.id, section_ids);

  res.json(enrichPurchases([db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id)])[0]);
});

router.delete('/:id', requireAuth, requireRole('super_admin', 'purchase_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM purchases WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
