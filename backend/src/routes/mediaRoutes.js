const express = require('express');
const { upload } = require('../middleware/upload');
const { uploadProductMedia } = require('../controllers/mediaController');
const { authenticate, authorize, requireApprovedAccount } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/upload/product-media',
  authenticate,
  authorize(['shop_owner', 'admin']),
  requireApprovedAccount,
  upload.array('files', 10),
  uploadProductMedia
);

module.exports = router;
