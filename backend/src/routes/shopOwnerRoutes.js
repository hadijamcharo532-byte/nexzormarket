const express = require('express');
const { submitShopOwnerApplication, uploadShopOwnerImage } = require('../controllers/applicationController');
const { onboardingImageUpload } = require('../middleware/upload');

const router = express.Router();

router.post('/upload-image', onboardingImageUpload.single('image'), uploadShopOwnerImage);
router.post('/apply', submitShopOwnerApplication);

module.exports = router;
