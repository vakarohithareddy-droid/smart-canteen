// routes/cart.js — MVC: thin route file, logic in controller
const express = require('express');
const { getCart, upsertCartItem, removeCartItem, clearCart } = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/',         protect, getCart);
router.post('/',        protect, upsertCartItem);
router.delete('/:menuItemId', protect, removeCartItem);
router.delete('/',      protect, clearCart);

module.exports = router;
