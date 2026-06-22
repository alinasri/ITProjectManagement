const express = require('express');
const db = require('../db/schema');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recordStatusChange, setSections } = require('../db/helpers');

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


router.get('/', requireAuth, requireRole('super_admin', 'it_head', 'tender_admin', 'section_head'), (req, res) => {
  const showArchived = req.query.archived === '1' ? 1 : 0;
  const filterSection = req.user.role === 'section_head' ? req.user.section_id : req.query.section_id;
  let rows;
  if (filterSection) {
    rows = db.prepare(
      `SELECT DISTINCT t.* FROM tenders t
       JOIN tender_sections ts ON ts.tender_id = t.id
       WHERE ts.section_id = ? AND t.is_archived = ? AND t.is_deleted = 0 ORDER BY t.id`
    ).all(filterSection, showArchived);
  } else {
    rows = db.prepare('SELECT * FROM tenders WHERE is_archived = ? AND is_deleted = 0 ORDER BY id').all(showArchived);
  }
  res.json(enrichTenders(rows));
});

router.post('/', requireAuth, requireRole('super_admin', 'tender_admin'), (req, res) => {
  const { title, status, estimated_amount, deadline, winner, description, section_ids } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

  const initialStatus = status || 'open';
  const result = db.prepare(
    `INSERT INTO tenders (title, status, estimated_amount, deadline, winner, description)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    title.trim(), initialStatus, estimated_amount || '', deadline || '', winner || '', description || ''
  );
  const id = result.lastInsertRowid;
  recordStatusChange('tender', id, null, initialStatus, req.user.id);
  if (Array.isArray(section_ids)) setSections('tender_sections', 'tender_id', id, section_ids);
  const row = db.prepare('SELECT * FROM tenders WHERE id = ?').get(id);
  res.status(201).json(enrichTenders([row])[0]);
});

router.get('/:id/history', requireAuth, requireRole('super_admin', 'it_head', 'tender_admin'), (req, res) => {
  const rows = db.prepare(
    `SELECT sh.*, u.username as changed_by_username
     FROM status_history sh
     LEFT JOIN users u ON u.id = sh.changed_by
     WHERE sh.entity_type = 'tender' AND sh.entity_id = ?
     ORDER BY sh.changed_at DESC`
  ).all(req.params.id);
  res.json(rows);
});

router.put('/:id', requireAuth, requireRole('super_admin', 'tender_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM tenders WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const { title, status, estimated_amount, deadline, winner, description, section_ids } = req.body;
  const newStatus = status ?? row.status;
  db.prepare(
    `UPDATE tenders SET title = ?, status = ?, estimated_amount = ?, deadline = ?, winner = ?, description = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    title ?? row.title,
    newStatus,
    estimated_amount ?? row.estimated_amount,
    deadline ?? row.deadline,
    winner ?? row.winner,
    description ?? row.description,
    req.params.id
  );
  recordStatusChange('tender', req.params.id, row.status, newStatus, req.user.id);

  if (Array.isArray(section_ids)) setSections(req.params.id, section_ids);

  res.json(enrichTenders([db.prepare('SELECT * FROM tenders WHERE id = ?').get(req.params.id)])[0]);
});

router.patch('/:id/archive', requireAuth, requireRole('super_admin', 'tender_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM tenders WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const archive = req.body.archive === false ? 0 : 1;
  db.prepare(`UPDATE tenders SET is_archived = ?, updated_at = datetime('now') WHERE id = ?`).run(archive, req.params.id);
  res.json({ ok: true, is_archived: archive });
});

router.delete('/:id', requireAuth, requireRole('super_admin', 'tender_admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM tenders WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const ageMs = Date.now() - new Date(row.created_at + 'Z').getTime();
  if (ageMs > 10 * 60 * 1000) {
    return res.status(409).json({ error: 'older_than_10_min' });
  }
  db.prepare('UPDATE tenders SET is_deleted = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
