// routes/sections.js — HTTP handlers for section management.

const express        = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const sectionService = require('../services/sectionService');
const { wrap }       = require('../utils/routeUtils');

const router = express.Router();

// GET is open to all authenticated users — sections are needed in dropdowns everywhere.
router.get('/',    requireAuth,                            wrap(200, ()   => sectionService.list()));
router.post('/',   requireAuth, requireRole('super_admin'), wrap(201, req => sectionService.create(req.body)));
router.put('/:id', requireAuth, requireRole('super_admin'), wrap(200, req => sectionService.update(req.params.id, req.body)));
router.delete('/:id', requireAuth, requireRole('super_admin'), wrap(200, req => sectionService.remove(req.params.id)));

module.exports = router;
