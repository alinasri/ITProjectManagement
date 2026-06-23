// services/purchaseService.js — Business logic for purchases.
//
// Purchases differ from projects: ownership is managed by purchase_admin role
// (not section_head), so update/archive/delete have no data-level ownership check —
// the role check in the route's requireRole() middleware is sufficient.

const purchaseRepo = require('../repositories/purchaseRepository');
const { recordStatusChange, setSections, isWithinDeletionWindow } = require('../db/helpers');
const ServiceError = require('../utils/serviceError');

function list(user, { section_id, archived }) {
  const showArchived = archived === '1' ? 1 : 0;
  // section_head sees only purchases linked to their section via the join table.
  const sectionId    = user.role === 'section_head' ? user.section_id : section_id;
  return purchaseRepo.enrich(purchaseRepo.findAll({ sectionId, showArchived }));
}

function create(user, body) {
  const { title, status, supplier, amount, purchase_date, description, section_ids } = body;
  if (!title?.trim()) throw new ServiceError(400, 'Title required');
  const initialStatus = status || 'pending';
  const row = purchaseRepo.create({
    title: title.trim(), status: initialStatus,
    supplier: supplier || '', amount: amount || '',
    purchase_date: purchase_date || '', description: description || '',
  });
  recordStatusChange('purchase', row.id, null, initialStatus, user.id);
  // setSections links the purchase to one or more sections via the join table.
  if (Array.isArray(section_ids)) setSections('purchase_sections', 'purchase_id', row.id, section_ids);
  return purchaseRepo.enrich([row])[0];
}

function update(user, id, body) {
  const row = purchaseRepo.findById(id);
  if (!row) throw new ServiceError(404, 'Not found');
  const { title, status, supplier, amount, purchase_date, description, section_ids } = body;
  const newStatus = status ?? row.status;
  const updated = purchaseRepo.update(id, {
    title:         title         ?? row.title,
    status:        newStatus,
    supplier:      supplier      ?? row.supplier,
    amount:        amount        ?? row.amount,
    purchase_date: purchase_date ?? row.purchase_date,
    description:   description   ?? row.description,
  });
  recordStatusChange('purchase', id, row.status, newStatus, user.id);
  if (Array.isArray(section_ids)) setSections('purchase_sections', 'purchase_id', id, section_ids);
  return purchaseRepo.enrich([updated])[0];
}

function archive(id, archiveFlag) {
  const row = purchaseRepo.findById(id);
  if (!row) throw new ServiceError(404, 'Not found');
  const archive = archiveFlag === false ? 0 : 1;
  purchaseRepo.setArchived(id, archive);
  return { ok: true, is_archived: archive };
}

function softDelete(id) {
  const row = purchaseRepo.findById(id);
  if (!row) throw new ServiceError(404, 'Not found');
  if (!isWithinDeletionWindow(row.created_at)) throw new ServiceError(409, 'older_than_10_min');
  purchaseRepo.softDelete(id);
  return { ok: true };
}

function getHistory(id) { return purchaseRepo.getHistory(id); }

module.exports = { list, create, update, archive, softDelete, getHistory };
