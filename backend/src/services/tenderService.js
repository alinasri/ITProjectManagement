// services/tenderService.js — Business logic for tenders.
// Same structure as purchaseService; ownership is managed by tender_admin role.

const tenderRepo   = require('../repositories/tenderRepository');
const { recordStatusChange, setSections, isWithinDeletionWindow } = require('../db/helpers');
const ServiceError = require('../utils/serviceError');

function list(user, { section_id, archived }) {
  const showArchived = archived === '1' ? 1 : 0;
  const sectionId    = user.role === 'section_head' ? user.section_id : section_id;
  return tenderRepo.enrich(tenderRepo.findAll({ sectionId, showArchived }));
}

function create(user, body) {
  const { title, status, estimated_amount, deadline, winner, description, section_ids } = body;
  if (!title?.trim()) throw new ServiceError(400, 'Title required');
  const initialStatus = status || 'open';
  const row = tenderRepo.create({
    title: title.trim(), status: initialStatus,
    estimated_amount: estimated_amount || '', deadline: deadline || '',
    winner: winner || '', description: description || '',
  });
  recordStatusChange('tender', row.id, null, initialStatus, user.id);
  if (Array.isArray(section_ids)) setSections('tender_sections', 'tender_id', row.id, section_ids);
  return tenderRepo.enrich([row])[0];
}

function update(user, id, body) {
  const row = tenderRepo.findById(id);
  if (!row) throw new ServiceError(404, 'Not found');
  const { title, status, estimated_amount, deadline, winner, description, section_ids } = body;
  const newStatus = status ?? row.status;
  const updated = tenderRepo.update(id, {
    title:            title            ?? row.title,
    status:           newStatus,
    estimated_amount: estimated_amount ?? row.estimated_amount,
    deadline:         deadline         ?? row.deadline,
    winner:           winner           ?? row.winner,
    description:      description      ?? row.description,
  });
  recordStatusChange('tender', id, row.status, newStatus, user.id);
  if (Array.isArray(section_ids)) setSections('tender_sections', 'tender_id', id, section_ids);
  return tenderRepo.enrich([updated])[0];
}

function archive(id, archiveFlag) {
  const row = tenderRepo.findById(id);
  if (!row) throw new ServiceError(404, 'Not found');
  const archive = archiveFlag === false ? 0 : 1;
  tenderRepo.setArchived(id, archive);
  return { ok: true, is_archived: archive };
}

function softDelete(id) {
  const row = tenderRepo.findById(id);
  if (!row) throw new ServiceError(404, 'Not found');
  if (!isWithinDeletionWindow(row.created_at)) throw new ServiceError(409, 'older_than_10_min');
  tenderRepo.softDelete(id);
  return { ok: true };
}

function getHistory(id) { return tenderRepo.getHistory(id); }

module.exports = { list, create, update, archive, softDelete, getHistory };
