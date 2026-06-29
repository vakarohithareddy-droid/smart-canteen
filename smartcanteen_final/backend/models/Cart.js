// ═══════════════════════════════════════════════════════════
//  models/Cart.js
//  MVC Architecture: Model layer — Cart schema
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  menuItemId: { type: Number, required: true },
  name:       { type: String, required: true },
  emoji:      { type: String, default: '🍽' },
  price:      { type: Number, required: true },
  qty:        { type: Number, required: true, min: 1 },
});

const CartSchema = new mongoose.Schema(
  {
    user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [CartItemSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', CartSchema);
