const express = require('express');
const {
  getPendingShopOwnerRequests,
  approveShopOwnerRequest,
  rejectShopOwnerRequest,
} = require('../controllers/applicationController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/shop-owner-requests', authenticate, authorize(['admin']), getPendingShopOwnerRequests);
router.put('/shop-owner-requests/:id/approve', authenticate, authorize(['admin']), approveShopOwnerRequest);
router.put('/shop-owner-requests/:id/reject', authenticate, authorize(['admin']), rejectShopOwnerRequest);

module.exports = router;
