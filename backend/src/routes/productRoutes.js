const express = require('express');
const {
	getProducts,
	getProduct,
	createProduct,
	updateProduct,
	searchProducts,
	searchSuggestions,
} = require('../controllers/productController');
const { authenticate, authorize, requireApprovedAccount } = require('../middleware/auth');

const router = express.Router();

router.get('/', getProducts);
router.get('/search', searchProducts);
router.get('/search/suggestions', searchSuggestions);
router.get('/:id', getProduct);
router.post('/', authenticate, authorize(['shop_owner', 'admin']), requireApprovedAccount, createProduct);
router.put('/:id', authenticate, authorize(['shop_owner', 'admin']), requireApprovedAccount, updateProduct);

module.exports = router;
