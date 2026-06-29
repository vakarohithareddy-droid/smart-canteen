// routes/orders.js — MVC: thin route file, logic in controller
const express = require('express');
const {
  placeOrder,
  getOrders,
  updateOrderStatus,
  getStats,
} = require('../controllers/orderController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// ── Order routes ─────────────────────────────────────────────
router.post('/',      protect, placeOrder);                  // Place order
router.get('/stats',  protect, adminOnly, getStats);
router.get('/',       protect, getOrders);
router.put('/:id',    protect, adminOnly, updateOrderStatus);

module.exports = router;
