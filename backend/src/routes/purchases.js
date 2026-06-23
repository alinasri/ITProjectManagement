// routes/purchases.js — HTTP handlers for purchases.

const express          = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const purchaseService  = require('../services/purchaseService');
const { wrap }         = require('../utils/routeUtils');

const router = express.Router();

router.get('/', requireAuth, requireRole('super_admin', 'it_head', 'purchase_admin', 'section_head'),
  wrap(200, req => purchaseService.list(req.user, req.query)));

router.post('/', requireAuth, requireRole('super_admin', 'purchase_admin'),
  wrap(201, req => purchaseService.create(req.user, req.body)));

router.get('/:id/history', requireAuth, requireRole('super_admin', 'it_head', 'purchase_admin'),
  wrap(200, req => purchaseService.getHistory(req.params.id)));

router.put('/:id', requireAuth, requireRole('super_admin', 'purchase_admin'),
  wrap(200, req => purchaseService.update(req.user, req.params.id, req.body)));

router.patch('/:id/archive', requireAuth, requireRole('super_admin', 'purchase_admin'),
  wrap(200, req => purchaseService.archive(req.params.id, req.body.archive)));

router.delete('/:id', requireAuth, requireRole('super_admin', 'purchase_admin'),
  wrap(200, req => purchaseService.softDelete(req.params.id)));

module.exports = router;
