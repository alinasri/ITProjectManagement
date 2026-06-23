// services/sectionService.js — Business logic for sections.

const sectionRepo  = require('../repositories/sectionRepository');
const ServiceError = require('../utils/serviceError');

function list() {
  return sectionRepo.findAll();
}

function create({ name }) {
  if (!name?.trim()) throw new ServiceError(400, 'Name required');
  return sectionRepo.create({ name: name.trim() });
}

function update(id, { name }) {
  if (!name?.trim()) throw new ServiceError(400, 'Name required');
  const section = sectionRepo.findById(id);
  if (!section) throw new ServiceError(404, 'Not found');
  return sectionRepo.update(id, { name: name.trim() });
}

// remove — hard-deletes a section. Blocked if the section contains any data.
// WHY hard-delete (not soft): sections have no audit-sensitive history of their own.
// WHY blocked when data exists: cascading deletes would silently wipe projects, tasks,
// and personnel — too destructive for a UI action. The caller must clear data first.
function remove(id) {
  const section = sectionRepo.findById(id);
  if (!section) throw new ServiceError(404, 'Not found');
  if (sectionRepo.countRelatedData(id) > 0) throw new ServiceError(409, 'has_data');
  sectionRepo.remove(id);
  return { ok: true };
}

module.exports = { list, create, update, remove };
