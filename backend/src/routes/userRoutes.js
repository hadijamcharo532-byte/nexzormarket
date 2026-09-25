const express = require('express');
const { getUsers, getUser, updateUser, updateUserStatus } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, authorize(['admin']), getUsers);
router.get('/:id', authenticate, getUser);
router.put('/:id', authenticate, updateUser);
router.patch('/:id/status', authenticate, authorize(['admin']), updateUserStatus);

module.exports = router;
