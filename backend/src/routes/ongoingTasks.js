// routes/ongoingTasks.js — HTTP handlers for ongoing tasks.

const express           = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const ongoingTaskService = require('../services/ongoingTaskService');
const { wrap }          = require('../utils/routeUtils');

const router = express.Router();

router.get('/', requireAuth, wrap(200, req => ongoingTaskService.list(req.user, req.query)));

router.post('/', requireAuth, requireRole('super_admin', 'section_head'),
  wrap(201, req => ongoingTaskService.create(req.user, req.body)));

router.get('/:id/history', requireAuth,
  wrap(200, req => ongoingTaskService.getHistory(req.params.id)));

router.put('/:id', requireAuth, requireRole('super_admin', 'section_head'),
  wrap(200, req => ongoingTaskService.update(req.user, req.params.id, req.body)));

router.patch('/:id/archive', requireAuth, requireRole('super_admin', 'section_head'),
  wrap(200, req => ongoingTaskService.archive(req.user, req.params.id, req.body.archive)));

router.delete('/:id', requireAuth, requireRole('super_admin', 'section_head'),
  wrap(200, req => ongoingTaskService.softDelete(req.user, req.params.id)));

module.exports = router;
