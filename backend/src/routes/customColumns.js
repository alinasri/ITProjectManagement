// routes/customColumns.js — HTTP handlers for custom project columns.

const express             = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const customColumnService = require('../services/customColumnService');
const { wrap }            = require('../utils/routeUtils');

const router = express.Router();

router.get('/', requireAuth, wrap(200, req => customColumnService.list(req.user, req.query)));

router.post('/', requireAuth, requireRole('super_admin', 'section_head'),
  wrap(201, req => customColumnService.create(req.user, req.body)));

router.delete('/:id', requireAuth, requireRole('super_admin', 'section_head'),
  wrap(200, req => customColumnService.remove(req.user, req.params.id)));

module.exports = router;
