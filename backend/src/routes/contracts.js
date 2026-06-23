// routes/contracts.js — HTTP handlers for contracts.

const express          = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const contractService  = require('../services/contractService');
const { wrap }         = require('../utils/routeUtils');

const router = express.Router();

router.get('/', requireAuth, requireRole('super_admin', 'it_head', 'contract_admin', 'section_head'),
  wrap(200, req => contractService.list(req.user, req.query)));

router.post('/', requireAuth, requireRole('super_admin', 'contract_admin'),
  wrap(201, req => contractService.create(req.user, req.body)));

router.get('/:id/history', requireAuth, requireRole('super_admin', 'it_head', 'contract_admin'),
  wrap(200, req => contractService.getHistory(req.params.id)));

router.put('/:id', requireAuth, requireRole('super_admin', 'contract_admin'),
  wrap(200, req => contractService.update(req.user, req.params.id, req.body)));

router.patch('/:id/archive', requireAuth, requireRole('super_admin', 'contract_admin'),
  wrap(200, req => contractService.archive(req.params.id, req.body.archive)));

router.delete('/:id', requireAuth, requireRole('super_admin', 'contract_admin'),
  wrap(200, req => contractService.softDelete(req.params.id)));

module.exports = router;
