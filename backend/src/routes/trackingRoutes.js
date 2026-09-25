const express = require('express');
const { getLocations, createLocation } = require('../controllers/trackingController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, getLocations);
router.post('/', authenticate, createLocation);

module.exports = router;
