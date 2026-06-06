const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function enrichTenders(rows) {
  return rows.map(r => {
    const sections = db.prepare(
      `SELECT s.id, s.name FROM tender_sections ts
       JOIN sections s ON s.id = ts.section_id
       WHERE ts.tender_id = ? ORDER BY s.name`
    ).all(r.id);
    return { ...r, sections };
  });
}

function setSections(id, sectionIds) {
  db.prepare('DELETE FROM tender_sections WHERE tender_id = ?').run(id);
  const insert = db.prepare('INSERT INTO tender_sections (tender_id, section_id) VALUES (?, ?)');
  sectionIds.forEach(sid => insert.run(id, sid));
}

router.get('/', requireAuth, requireRole('super_admin', 'it_head', 'tender_admin'), (req, res) => {
  const rows = db.prepare('SELECT * FROM tenders ORDER BY id').all();
  res.json(enrichTenders(rows));
});

router.post('/', requireAuth, requireRole('super_admin', 'tender_admin'), (req, res) => {
  const { title, status, estimated_amount, deadline, winner, description, section_ids } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

  const result = db.prepare(
    `INSERT INTO tenders (title, status, estimated_amount, deadline, winner, description)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    title.trim(), status || 'open', estimated_amount || '', deadline || '', winner || '', description || ''
  );
  const id = result.lastInsertRowid;
  if (Array.isArray(section_ids)) setSections(id, section_ids);
  const row = db.prepare('SELECT * FROM tenders WHERE id = ?').get(id);
  res.status(201).json(enrichTenders([row])[0]);
});

router.put('/:id', requireAuth, requireRole('super_admin', 'tender_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM tenders WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const { title, status, estimated_amount, deadline, winner, description, section_ids } = req.body;
  db.prepare(
    `UPDATE tenders SET title = ?, status = ?, estimated_amount = ?, deadline = ?, winner = ?, description = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    title ?? row.title,
    status ?? row.status,
    estimated_amount ?? row.estimated_amount,
    deadline ?? row.deadline,
    winner ?? row.winner,
    description ?? row.description,
    req.params.id
  );

  if (Array.isArray(section_ids)) setSections(req.params.id, section_ids);

  res.json(enrichTenders([db.prepare('SELECT * FROM tenders WHERE id = ?').get(req.params.id)])[0]);
});

router.delete('/:id', requireAuth, requireRole('super_admin', 'tender_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM tenders WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM tenders WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
