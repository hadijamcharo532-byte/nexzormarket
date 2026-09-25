const express = require('express');
const { getPayments, createPayment, updatePayment } = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, getPayments);
router.post('/', authenticate, createPayment);
router.put('/:id', authenticate, updatePayment);

module.exports = router;
