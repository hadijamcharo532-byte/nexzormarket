const express = require('express');
const {
  submitShopOwnerApplication,
  submitDriverApplication,
  getPendingApplications,
  getApplicationById,
  getMyApplications,
  reviewApplication,
} = require('../controllers/applicationController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/shop-owner', submitShopOwnerApplication);
router.post('/driver', submitDriverApplication);

router.get('/admin/pending/list', authenticate, authorize(['admin']), getPendingApplications);
router.patch('/admin/:id/review', authenticate, authorize(['admin']), reviewApplication);

router.get('/me', authenticate, getMyApplications);
router.get('/:id', authenticate, getApplicationById);

module.exports = router;
