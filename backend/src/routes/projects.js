// routes/projects.js — HTTP handlers for projects.
//
// Every handler follows the same pattern: parse req → call service → send response.
// Error handling is provided by wrap() in routeUtils so there is no try/catch here.

const express        = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const projectService = require('../services/projectService');
const { wrap }       = require('../utils/routeUtils');

const router = express.Router();

router.get('/', requireAuth, wrap(200, req => projectService.list(req.user, req.query)));

router.post('/', requireAuth, requireRole('super_admin', 'section_head'),
  wrap(201, req => projectService.create(req.user, req.body)));

// IMPORTANT: /deadline-changes must be defined BEFORE /:id/history.
// Express matches routes in order; if /:id came first, the literal string
// "deadline-changes" would be captured as the :id parameter instead.
router.get('/deadline-changes', requireAuth, requireRole('super_admin', 'it_head'),
  wrap(200, () => projectService.getDeadlineChanges()));

router.get('/:id/history', requireAuth,
  wrap(200, req => projectService.getHistory(req.params.id)));

router.put('/:id', requireAuth, requireRole('super_admin', 'section_head'),
  wrap(200, req => projectService.update(req.user, req.params.id, req.body)));

router.patch('/:id/archive', requireAuth, requireRole('super_admin', 'section_head'),
  wrap(200, req => projectService.archive(req.user, req.params.id, req.body.archive)));

router.delete('/:id', requireAuth, requireRole('super_admin', 'section_head'),
  wrap(200, req => projectService.softDelete(req.user, req.params.id)));

module.exports = router;
