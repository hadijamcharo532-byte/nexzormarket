const express = require('express');
const { getNotifications } = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, getNotifications);

module.exports = router;
