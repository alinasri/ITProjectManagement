// services/userService.js — Business logic for user account management.

const bcrypt       = require('bcryptjs');
const userRepo     = require('../repositories/userRepository');
const { isWithinDeletionWindow } = require('../db/helpers');
const ServiceError = require('../utils/serviceError');

// super_admin can only be created by the initial database seed, never via the API.
const VALID_ROLES = ['it_head', 'section_head', 'purchase_admin', 'tender_admin', 'contract_admin'];

function list() {
  return userRepo.findAll();
}

function create(body) {
  const { username, password, role, section_id } = body;
  if (!username?.trim() || !password || !role) throw new ServiceError(400, 'username, password and role are required');
  if (!VALID_ROLES.includes(role)) throw new ServiceError(400, 'Invalid role');
  if (role === 'section_head' && !section_id) throw new ServiceError(400, 'section_id required for section_head');
  if (userRepo.existsByUsername(username.trim())) throw new ServiceError(409, 'Username already exists');

  const hash = bcrypt.hashSync(password, 10);
  // must_change_password = 1 is baked into the repository INSERT so new users must
  // set their own password on first login rather than using the admin-chosen one.
  return userRepo.create({ username: username.trim(), hash, role, section_id });
}

function update(id, body) {
  const { username, password, role, section_id } = body;
  const user = userRepo.findById(id);
  if (!user) throw new ServiceError(404, 'Not found');
  if (user.role === 'super_admin') throw new ServiceError(403, 'Cannot modify super_admin');

  // Only hash a new password if one was provided; keep the existing hash otherwise.
  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;
  return userRepo.update(id, {
    username:   username?.trim()                          || user.username,
    hash:       newHash,
    role:       role                                      || user.role,
    // section_id !== undefined: explicitly sending null clears it; omitting the field keeps the old value.
    section_id: section_id !== undefined ? section_id : user.section_id,
  });
}

function toggleActive(id) {
  const user = userRepo.findById(id);
  if (!user) throw new ServiceError(404, 'Not found');
  if (user.role === 'super_admin') throw new ServiceError(403, 'Cannot disable super_admin');
  const newActive = user.is_active === 1 ? 0 : 1;
  userRepo.toggleActive(id, newActive);
  return { ok: true, is_active: newActive };
}

function softDelete(id) {
  const user = userRepo.findById(id);
  if (!user) throw new ServiceError(404, 'Not found');
  if (user.role === 'super_admin') throw new ServiceError(403, 'Cannot delete super_admin');
  if (!isWithinDeletionWindow(user.created_at)) throw new ServiceError(409, 'older_than_10_min');
  userRepo.softDelete(id);
  return { ok: true };
}

module.exports = { list, create, update, toggleActive, softDelete };
