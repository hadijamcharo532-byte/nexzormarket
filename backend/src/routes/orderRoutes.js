const express = require('express');
const { getOrders, getOrder, createOrder, updateOrder } = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, getOrders);
router.get('/:id', authenticate, getOrder);
router.post('/', authenticate, createOrder);
router.put('/:id', authenticate, updateOrder);

module.exports = router;
