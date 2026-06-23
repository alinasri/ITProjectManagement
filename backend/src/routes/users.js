// routes/users.js — HTTP handlers for user account management.
// All routes are super_admin only; access control is handled by requireRole.

const express     = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const userService = require('../services/userService');
const { wrap }    = require('../utils/routeUtils');

const router = express.Router();

router.get('/',                   requireAuth, requireRole('super_admin'), wrap(200, ()    => userService.list()));
router.post('/',                  requireAuth, requireRole('super_admin'), wrap(201, req  => userService.create(req.body)));
router.put('/:id',                requireAuth, requireRole('super_admin'), wrap(200, req  => userService.update(req.params.id, req.body)));
router.patch('/:id/toggle-active',requireAuth, requireRole('super_admin'), wrap(200, req  => userService.toggleActive(req.params.id)));
router.delete('/:id',             requireAuth, requireRole('super_admin'), wrap(200, req  => userService.softDelete(req.params.id)));

module.exports = router;
