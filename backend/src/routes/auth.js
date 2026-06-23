// routes/auth.js — HTTP handlers for authentication.
//
// WHAT THIS FILE DOES: parse req → call service → send response.
// WHAT IT DOES NOT DO: validate passwords, hash, generate tokens, hit the database.
// All of that is in services/authService.js.
//
// Cookie handling stays here (not in the service) because cookies are an HTTP concept.
// The service only returns a token string; the route decides how to deliver it.

const express     = require('express');
const { requireAuth } = require('../middleware/auth');
const authService = require('../services/authService');
const { wrap }    = require('../utils/routeUtils');

const router = express.Router();

// POST /api/auth/login — login has its own try/catch because it also sets a cookie
// on success, which wrap() cannot do (wrap only calls res.json).
router.post('/login', (req, res) => {
  try {
    const { token, user } = authService.login(req.body);
    // httpOnly: true — JavaScript in the browser cannot read this cookie, preventing
    // XSS attacks from stealing the token.
    // maxAge mirrors the JWT's 8-hour expiry so the cookie and token expire together.
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 });
    res.json({ token, user });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/auth/logout — clears the cookie. No auth needed; expired sessions should
// also be clearable so users aren't stuck on the login page.
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, wrap(200, req => authService.getProfile(req.user.id)));

router.post('/change-password', requireAuth, wrap(200, req => authService.changePassword(req.user.id, req.body)));

module.exports = router;
