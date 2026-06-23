// services/personnelService.js — Business logic for personnel.

const personnelRepo = require('../repositories/personnelRepository');
const ServiceError  = require('../utils/serviceError');

function list(user, { section_id }) {
  if (user.role === 'section_head') return personnelRepo.findBySection(user.section_id);
  if (section_id) return personnelRepo.findBySection(section_id);
  return personnelRepo.findAll();
}

function create(user, { name, section_id }) {
  if (!name?.trim()) throw new ServiceError(400, 'Name required');
  // section_head is always forced to their own section to prevent cross-section manipulation.
  const sectionId = user.role === 'section_head' ? user.section_id : section_id;
  if (!sectionId) throw new ServiceError(400, 'section_id required');
  return personnelRepo.create({ name: name.trim(), sectionId });
}

function remove(user, id) {
  const person = personnelRepo.findById(id);
  if (!person) throw new ServiceError(404, 'Not found');
  if (user.role === 'section_head' && person.section_id !== user.section_id) {
    throw new ServiceError(403, 'Forbidden');
  }
  personnelRepo.remove(id);
  return { ok: true };
}

module.exports = { list, create, remove };
