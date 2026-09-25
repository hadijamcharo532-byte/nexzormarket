const express = require('express');
const { getShops, getShop, createShop, updateShop } = require('../controllers/shopController');
const { authenticate, authorize, requireApprovedAccount } = require('../middleware/auth');

const router = express.Router();

router.get('/', getShops);
router.get('/:id', getShop);
router.post('/', authenticate, authorize(['shop_owner', 'admin']), requireApprovedAccount, createShop);
router.put('/:id', authenticate, updateShop);

module.exports = router;
