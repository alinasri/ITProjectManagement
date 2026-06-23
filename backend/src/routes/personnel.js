// routes/personnel.js — HTTP handlers for personnel management.

const express           = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const personnelService  = require('../services/personnelService');
const { wrap }          = require('../utils/routeUtils');

const router = express.Router();

// GET is open to all authenticated users (section_head scoping is applied in the service).
router.get('/',    requireAuth,                                        wrap(200, req => personnelService.list(req.user, req.query)));
router.post('/',   requireAuth, requireRole('super_admin', 'section_head'), wrap(201, req => personnelService.create(req.user, req.body)));
router.delete('/:id', requireAuth, requireRole('super_admin', 'section_head'), wrap(200, req => personnelService.remove(req.user, req.params.id)));

module.exports = router;
