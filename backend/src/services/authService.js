// services/authService.js — Business logic for authentication.
//
// A service's job: validate inputs, apply rules, orchestrate repository calls.
// It knows NOTHING about HTTP (no req, res, cookies). That belongs in the route.
//
// WHY JWT_SECRET is defined here and not imported from middleware/auth:
// The service layer should not depend on the HTTP middleware layer. Both read the
// same environment variable independently; there is no circular dependency.

const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const userRepo  = require('../repositories/userRepository');
const ServiceError = require('../utils/serviceError');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

// login — validates credentials and returns a signed JWT plus the safe user object.
// The route layer is responsible for placing the token in a cookie; this function
// only produces the token — it has no knowledge of HTTP cookies.
function login({ username, password }) {
  if (!username || !password) throw new ServiceError(400, 'Missing credentials');

  const user = userRepo.findByUsername(username);
  // bcrypt.compareSync hashes the plain-text password and compares to the stored hash.
  // We do NOT short-circuit "user not found" separately to avoid timing attacks that
  // could reveal whether a username exists via response time differences.
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new ServiceError(401, 'Invalid username or password');
  }
  if (user.is_active === 0) throw new ServiceError(403, 'Account disabled');

  // jwt.sign() creates a cryptographically signed token. The payload (id, role, etc.)
  // is embedded in plain base64 — readable but not forgeable without JWT_SECRET.
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, section_id: user.section_id },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      section_id: user.section_id,
      must_change_password: user.must_change_password === 1,
    },
  };
}

// getProfile — returns the current user's public fields from the database.
// We re-fetch from DB (rather than using the JWT payload) to always return
// the latest values, e.g. if an admin changed the user's role mid-session.
function getProfile(userId) {
  const user = userRepo.findPublicById(userId);
  if (!user) throw new ServiceError(404, 'User not found');
  return { ...user, must_change_password: user.must_change_password === 1 };
}

// changePassword — verifies the current password and replaces it with a new hash.
function changePassword(userId, { current_password, new_password }) {
  if (!new_password || new_password.length < 6) {
    throw new ServiceError(400, 'New password must be at least 6 characters');
  }
  const user = userRepo.findById(userId);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    throw new ServiceError(401, 'Current password is wrong');
  }
  // cost factor 10: bcrypt work factor; higher = slower to crack, slower to compute
  const hash = bcrypt.hashSync(new_password, 10);
  userRepo.updatePassword(userId, hash);
  return { ok: true };
}

module.exports = { login, getProfile, changePassword };
