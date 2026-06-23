// routes/tenders.js — HTTP handlers for tenders.

const express        = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const tenderService  = require('../services/tenderService');
const { wrap }       = require('../utils/routeUtils');

const router = express.Router();

router.get('/', requireAuth, requireRole('super_admin', 'it_head', 'tender_admin', 'section_head'),
  wrap(200, req => tenderService.list(req.user, req.query)));

router.post('/', requireAuth, requireRole('super_admin', 'tender_admin'),
  wrap(201, req => tenderService.create(req.user, req.body)));

router.get('/:id/history', requireAuth, requireRole('super_admin', 'it_head', 'tender_admin'),
  wrap(200, req => tenderService.getHistory(req.params.id)));

router.put('/:id', requireAuth, requireRole('super_admin', 'tender_admin'),
  wrap(200, req => tenderService.update(req.user, req.params.id, req.body)));

router.patch('/:id/archive', requireAuth, requireRole('super_admin', 'tender_admin'),
  wrap(200, req => tenderService.archive(req.params.id, req.body.archive)));

router.delete('/:id', requireAuth, requireRole('super_admin', 'tender_admin'),
  wrap(200, req => tenderService.softDelete(req.params.id)));

module.exports = router;
