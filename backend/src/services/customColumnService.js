// services/customColumnService.js — Business logic for custom project columns.

const colRepo      = require('../repositories/customColumnRepository');
const ServiceError = require('../utils/serviceError');

function list(user, { section_id }) {
  const sectionId = user.role === 'section_head' ? user.section_id : section_id;
  if (!sectionId) return colRepo.findAll();
  return colRepo.findBySection(sectionId);
}

function create(user, { column_name, section_id }) {
  if (!column_name?.trim()) throw new ServiceError(400, 'column_name required');
  const sectionId = user.role === 'section_head' ? user.section_id : section_id;
  if (!sectionId) throw new ServiceError(400, 'section_id required');
  return colRepo.create({ sectionId, column_name: column_name.trim() });
}

function remove(user, id) {
  const col = colRepo.findById(id);
  if (!col) throw new ServiceError(404, 'Not found');
  if (user.role === 'section_head' && col.section_id !== user.section_id) {
    throw new ServiceError(403, 'Forbidden');
  }
  colRepo.remove(id);
  return { ok: true };
}

module.exports = { list, create, remove };
