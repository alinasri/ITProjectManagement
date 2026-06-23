// services/contractService.js — Business logic for contracts.
// Same structure as purchaseService; ownership is managed by contract_admin role.

const contractRepo = require('../repositories/contractRepository');
const { recordStatusChange, setSections, isWithinDeletionWindow } = require('../db/helpers');
const ServiceError = require('../utils/serviceError');

function list(user, { section_id, archived }) {
  const showArchived = archived === '1' ? 1 : 0;
  const sectionId    = user.role === 'section_head' ? user.section_id : section_id;
  return contractRepo.enrich(contractRepo.findAll({ sectionId, showArchived }));
}

function create(user, body) {
  const { title, status, counterparty, start_date, end_date, amount, description, section_ids } = body;
  if (!title?.trim()) throw new ServiceError(400, 'Title required');
  const initialStatus = status || 'active';
  const row = contractRepo.create({
    title: title.trim(), status: initialStatus,
    counterparty: counterparty || '', start_date: start_date || '',
    end_date: end_date || '', amount: amount || '', description: description || '',
  });
  recordStatusChange('contract', row.id, null, initialStatus, user.id);
  if (Array.isArray(section_ids)) setSections('contract_sections', 'contract_id', row.id, section_ids);
  return contractRepo.enrich([row])[0];
}

function update(user, id, body) {
  const row = contractRepo.findById(id);
  if (!row) throw new ServiceError(404, 'Not found');
  const { title, status, counterparty, start_date, end_date, amount, description, section_ids } = body;
  const newStatus = status ?? row.status;
  const updated = contractRepo.update(id, {
    title:        title        ?? row.title,
    status:       newStatus,
    counterparty: counterparty ?? row.counterparty,
    start_date:   start_date   ?? row.start_date,
    end_date:     end_date     ?? row.end_date,
    amount:       amount       ?? row.amount,
    description:  description  ?? row.description,
  });
  recordStatusChange('contract', id, row.status, newStatus, user.id);
  if (Array.isArray(section_ids)) setSections('contract_sections', 'contract_id', id, section_ids);
  return contractRepo.enrich([updated])[0];
}

function archive(id, archiveFlag) {
  const row = contractRepo.findById(id);
  if (!row) throw new ServiceError(404, 'Not found');
  const archive = archiveFlag === false ? 0 : 1;
  contractRepo.setArchived(id, archive);
  return { ok: true, is_archived: archive };
}

function softDelete(id) {
  const row = contractRepo.findById(id);
  if (!row) throw new ServiceError(404, 'Not found');
  if (!isWithinDeletionWindow(row.created_at)) throw new ServiceError(409, 'older_than_10_min');
  contractRepo.softDelete(id);
  return { ok: true };
}

function getHistory(id) { return contractRepo.getHistory(id); }

module.exports = { list, create, update, archive, softDelete, getHistory };
