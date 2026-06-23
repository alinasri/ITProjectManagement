// services/reportService.js — Business logic for the public shareable report.

const crypto       = require('crypto');
const reportRepo   = require('../repositories/reportRepository');
const ServiceError = require('../utils/serviceError');

// getToken — returns the current report token, creating one if none exists yet.
// There is always exactly one token in the system (id = 1 in report_tokens).
function getToken() {
  let token = reportRepo.getToken();
  if (!token) {
    // crypto.randomBytes(24) produces 24 cryptographically secure random bytes.
    // hex encoding gives a 48-character string that is effectively unguessable.
    token = crypto.randomBytes(24).toString('hex');
    reportRepo.setToken(token);
  }
  return token;
}

// regenerateToken — creates a new token, invalidating all existing shared links.
function regenerateToken() {
  const token = crypto.randomBytes(24).toString('hex');
  reportRepo.setToken(token);
  return token;
}

// getPublicReport — validates the URL token and returns a full data snapshot.
// The token in the URL is the only access control for this endpoint.
function getPublicReport(token) {
  const storedToken = reportRepo.getToken();
  if (!storedToken || storedToken !== token) throw new ServiceError(404, 'Not found');
  return { generated_at: new Date().toISOString(), ...reportRepo.getAllData() };
}

module.exports = { getToken, regenerateToken, getPublicReport };
