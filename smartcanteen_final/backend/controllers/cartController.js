// ═══════════════════════════════════════════════════════════
//  controllers/cartController.js
//  MVC Architecture: Controller layer — Cart business logic
// ═══════════════════════════════════════════════════════════

const Cart = require('../models/Cart');

// @desc  Get user's cart
// @route GET /api/cart
const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    res.json({ success: true, data: cart || { items: [] } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Add or update item in cart
// @route POST /api/cart
const upsertCartItem = async (req, res) => {
  try {
    const { menuItemId, name, emoji, price, qty } = req.body;
    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [{ menuItemId, name, emoji, price, qty }] });
    } else {
      const existing = cart.items.find(i => i.menuItemId === menuItemId);
      if (existing) {
        existing.qty = qty;
        if (existing.qty <= 0) {
          cart.items = cart.items.filter(i => i.menuItemId !== menuItemId);
        }
      } else {
        cart.items.push({ menuItemId, name, emoji, price, qty });
      }
      await cart.save();
    }
    res.json({ success: true, data: cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Remove single item from cart
// @route DELETE /api/cart/:menuItemId
const removeCartItem = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.items = cart.items.filter(i => i.menuItemId != req.params.menuItemId);
      await cart.save();
    }
    res.json({ success: true, data: cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Clear entire cart
// @route DELETE /api/cart
const clearCart = async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });
    res.json({ success: true, message: 'Cart cleared' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getCart, upsertCartItem, removeCartItem, clearCart };
