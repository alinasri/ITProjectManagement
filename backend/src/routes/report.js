// routes/report.js — HTTP handlers for the public shareable report.

const express        = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const reportService  = require('../services/reportService');
const { wrap }       = require('../utils/routeUtils');

const router = express.Router();

router.get('/token', requireAuth, requireRole('super_admin', 'it_head'),
  wrap(200, () => ({ token: reportService.getToken() })));

router.post('/regenerate', requireAuth, requireRole('super_admin'),
  wrap(200, () => ({ token: reportService.regenerateToken() })));

// This route has no requireAuth — the token in the URL is the only access control.
router.get('/public/:token',
  wrap(200, req => reportService.getPublicReport(req.params.token)));

module.exports = router;
