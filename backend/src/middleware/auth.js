// middleware/auth.js — Authentication and authorization middleware.
// Middleware functions have the signature (req, res, next).
// They either send a response (stopping the chain) or call next() to continue to the
// next middleware or route handler.

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

// requireAuth — guards any route that requires a logged-in user.
// Looks for a JWT token in two places (in order):
//   1. HTTP-only cookie: req.cookies.token  — preferred; JS in the browser cannot read it
//   2. Authorization header: "Bearer <token>" — for API clients that can't use cookies
//
// On success: decodes the token payload into req.user and calls next() so the route
//             handler runs.
// On failure: responds with 401 immediately; next() is never called, so the route handler
//             is completely skipped.
function requireAuth(req, res, next) {
  // Optional chaining (?.) prevents a crash if req.cookies or req.headers.authorization
  // is undefined (e.g. the header was not sent at all).
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    // jwt.verify() checks the token's cryptographic signature and expiry date.
    // Throws an error if either is invalid, caught below.
    req.user = jwt.verify(token, JWT_SECRET);

    // Re-query the database to catch accounts disabled after the token was issued.
    // Without this, a deactivated user's token would still work until it expires (8h).
    const db = require('../db/schema');
    const user = db.prepare('SELECT is_active, is_deleted FROM users WHERE id = ?').get(req.user.id);
    if (!user || user.is_active === 0 || user.is_deleted === 1) {
      return res.status(401).json({ error: 'Account disabled' });
    }
    next(); // All checks passed — hand control to the next function in the chain.
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// requireRole(...roles) — checks that the authenticated user has one of the allowed roles.
// Must always be used AFTER requireAuth because it reads req.user (set by requireAuth).
//
// This is a higher-order function: it takes a list of roles and RETURNS a middleware
// function. Express calls that returned function with (req, res, next).
//
// Usage example:
//   router.get('/', requireAuth, requireRole('super_admin', 'it_head'), handler)
//   Express runs them left to right; if requireRole rejects, handler never runs.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, JWT_SECRET };
